import "server-only";
import { db } from "@/lib/supabase/server";
import { pushTo } from "@/lib/push";
import { MAKER_KINDS, OPEN_TASK, taskKindLabel } from "@/lib/constants";
import { canAssignTasks, canSeeTask, headsTeam, myTeam } from "@/lib/permissions";
import { operationsHeadIds, runnersOf, teamLeadIdsOf } from "@/lib/groups";
import { listGroups } from "@/lib/leads";

// "*" so newer columns (priority, migration 017) come along when they exist
export const TASK_FIELDS =
  "*, " +
  "brand:brands(id, name, lead_id), assignee:members!tasks_assignee_id_fkey(id, name), assigner:members!tasks_assigned_by_fkey(id, name), " +
  // Set when the task was given from a brand's content calendar (a post / reel planned there)
  "calendar:calendar_items(id, publish_on, platform)";

const isUuid = (v) => /^[0-9a-f-]{36}$/i.test(String(v || ""));

/**
 * Tasks for a view:
 *   mine     → assigned to me
 *   review   → waiting on a head (completed / client asked for changes) — mine if I'm a head, all for staff
 *   assigned → tasks I assigned
 *   brand    → one brand's tasks
 *   all      → everything (heads / staff)
 */
export async function listTasks(me, { view = "mine", brandId, status } = {}) {
  let q = db().from("tasks").select(TASK_FIELDS).order("due_at", { ascending: true, nullsFirst: false }).limit(2000);
  if (view === "mine") q = q.eq("assignee_id", me.id);
  else if (!canAssignTasks(me)) return [];
  else if (view === "review") q = q.in("status", ["completed", "client_rejected"]);
  else if (view === "assigned") q = q.eq("assigned_by", me.id);
  if (brandId) q = q.eq("brand_id", brandId);
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) return [];
  return data || [];
}

/** One task with its files (signed links) and history, or null if this member can't see it. */
export async function getTask(me, id) {
  if (!isUuid(id)) return null;
  const { data: t } = await db().from("tasks").select(TASK_FIELDS).eq("id", id).maybeSingle();
  if (!t || !canSeeTask(me, t)) return null;
  const [{ data: files }, { data: events }] = await Promise.all([
    db().from("task_files").select("id, revision, role, name, storage_path, url, size, created_at, uploader:members(name)").eq("task_id", id).order("created_at"),
    db().from("task_events").select("id, type, data, created_at, actor:members(name)").eq("task_id", id).order("created_at", { ascending: false }).limit(100),
  ]);
  const paths = (files || []).filter((f) => f.storage_path).map((f) => f.storage_path);
  let signed = {};
  if (paths.length) {
    const { data } = await db().storage.from("lead-docs").createSignedUrls(paths, 3600);
    signed = Object.fromEntries((data || []).filter((x) => x.signedUrl).map((x) => [x.path, x.signedUrl]));
  }
  const [raws, forTask] = await Promise.all([rawRequests(id), t.for_task_id ? forTaskOf(t.for_task_id) : null]);
  return { ...t, files: (files || []).map((f) => ({ ...f, href: f.storage_path ? signed[f.storage_path] || "" : f.url })), events: events || [], raws, forTask };
}

/**
 * The "shoot" tasks production was given for this task (raw photos / footage), each with the files it
 * delivered. Empty before migration 027.
 */
async function rawRequests(taskId) {
  const { data, error } = await db()
    .from("tasks")
    .select("id, title, status, due_at, revision, brief, created_at, assignee:members!tasks_assignee_id_fkey(id, name)")
    .eq("for_task_id", taskId)
    .order("created_at");
  if (error || !data?.length) return [];
  const { data: files } = await db()
    .from("task_files")
    .select("id, task_id, revision, role, name, storage_path, url, size, created_at")
    .in("task_id", data.map((r) => r.id))
    .eq("role", "deliverable")
    .order("created_at");
  const { data: notes } = await db()
    .from("task_events")
    .select("id, task_id, data, created_at, actor:members(name)")
    .in("task_id", data.map((r) => r.id))
    .eq("type", "note")
    .order("created_at");
  const paths = (files || []).filter((f) => f.storage_path).map((f) => f.storage_path);
  let signed = {};
  if (paths.length) {
    const { data: s } = await db().storage.from("lead-docs").createSignedUrls(paths, 3600);
    signed = Object.fromEntries((s || []).filter((x) => x.signedUrl).map((x) => [x.path, x.signedUrl]));
  }
  return data.map((r) => ({
    ...r,
    files: (files || []).filter((f) => f.task_id === r.id).map((f) => ({ ...f, href: f.storage_path ? signed[f.storage_path] || "" : f.url })),
    notes: (notes || []).filter((n) => n.task_id === r.id && n.data?.text),
  }));
}

/** The task a shoot was asked for: its title and who is waiting on it. */
async function forTaskOf(id) {
  const { data } = await db().from("tasks").select("id, title, kind, status, assignee:members!tasks_assignee_id_fkey(id, name)").eq("id", id).maybeSingle();
  return data || null;
}

/** Who shares approved work with clients: the CBOs and the admins. */
export async function sharerIds() {
  const [groups, { data: admins }] = await Promise.all([listGroups(), db().from("members").select("id").eq("role", "admin").eq("active", true)]);
  return [...new Set([...operationsHeadIds(groups), ...(admins || []).map((m) => m.id)])];
}

/** People in the Production group(s), team leads first — who raw photos / footage can be asked from. */
export async function productionPeople() {
  const groups = (await listGroups()).filter((g) => g.kind === "production");
  const leads = new Set(groups.flatMap(teamLeadIdsOf));
  const byId = new Map();
  for (const g of groups) for (const m of g.members) if (m.active) byId.set(m.id, { id: m.id, name: m.name, lead: leads.has(m.id) });
  return [...byId.values()].sort((a, b) => Number(b.lead) - Number(a.lead) || a.name.localeCompare(b.name));
}

/** People who can take tasks: active members of the designer / developer / video groups (and heads). */
/** Members who head at least one group or run groups as CBO (Krish, Udit, Arushi…). */
export async function headIds() {
  const { data, error } = await db().from("groups").select("*");
  return error ? [] : [...new Set((data || []).flatMap(runnersOf))];
}

/** A head who runs teams gives work to their own team and to the other heads — not to other heads' teams. */
function headRule(me) {
  return me && me.role !== "admin" && headsTeam(me);
}

/** May `me` give a task to this person? */
export async function canAssignTo(me, memberId) {
  if (!headRule(me)) return true;
  if (memberId === me.id || myTeam(me).includes(memberId)) return true;
  return (await headIds()).includes(memberId);
}

/**
 * People who can take tasks, with their open work: the designer / developer / video / … groups and the heads.
 * Pass `me` to get only the people *they* may assign to (a head: their team + the other heads + themselves).
 */
export async function listMakers(me) {
  const [{ data }, heads] = await Promise.all([
    db()
      .from("groups")
      .select("kind, group_members(member:members(id, name, active))")
      .in("kind", [...MAKER_KINDS, "execution", "sales", "strategy"]),
    headIds(),
  ]);
  const byId = new Map();
  for (const g of data || []) {
    for (const gm of g.group_members || []) {
      const m = gm.member;
      if (!m?.active) continue;
      const cur = byId.get(m.id) || { id: m.id, name: m.name, kinds: [] };
      cur.kinds.push(g.kind);
      byId.set(m.id, cur);
    }
  }
  if (heads.length) {
    const missing = heads.filter((id) => !byId.has(id));
    if (missing.length) {
      const { data: rows } = await db().from("members").select("id, name, active").in("id", missing);
      for (const m of rows || []) if (m.active) byId.set(m.id, { id: m.id, name: m.name, kinds: [] });
    }
    for (const id of heads) byId.get(id)?.kinds.push("head");
  }
  // Who shows up: everyone in a maker / creative strategist / sales group, plus the managers and CBOs
  const isMakerOrHead = (p) => p.kinds.some((k) => [...MAKER_KINDS, "execution", "sales", "strategy", "head"].includes(k));
  for (const [id, p] of byId) {
    const allowed = headRule(me) ? id === me.id || myTeam(me).includes(id) || heads.includes(id) : isMakerOrHead(p);
    if (!allowed) byId.delete(id);
  }
  const people = [...byId.values()];
  // Open work per person, so the head can pick someone free
  if (people.length) {
    const { data: open } = await db().from("tasks").select("assignee_id").in("status", OPEN_TASK).in("assignee_id", people.map((p) => p.id));
    const load = {};
    for (const t of open || []) load[t.assignee_id] = (load[t.assignee_id] || 0) + 1;
    people.forEach((p) => (p.open = load[p.id] || 0));
  }
  return people.sort((a, b) => a.name.localeCompare(b.name));
}

export async function logTask(taskId, actorId, type, data = {}) {
  await db().from("task_events").insert({ task_id: taskId, actor_id: actorId || null, type, data });
}

/** Phone / desktop notification about a task. */
export function notifyTask(memberIds, task, title, body = "") {
  const what = `${taskKindLabel(task.kind)} · ${task.brand?.name || ""}`.replace(/ · $/, "");
  return pushTo(memberIds, { title: `${title}: ${task.title}`, body: body || what, url: `/tasks/${task.id}`, tag: `task-${task.id}` });
}

/** Counts for the nav badge: my open tasks (+ the review queue for heads). */
export async function taskBadge(me) {
  const mine = db().from("tasks").select("id", { count: "exact", head: true }).eq("assignee_id", me.id).in("status", OPEN_TASK);
  const review = canAssignTasks(me)
    ? db().from("tasks").select("id", { count: "exact", head: true }).in("status", ["completed", "client_rejected"])
    : null;
  const [a, b] = await Promise.all([mine, review]);
  if (a.error) return 0; // before migration 009
  return (a.count || 0) + (b?.count || 0);
}

/** The current version's deliverable files (signed links) for tasks waiting on review: { taskId: [{ name, href }] }. */
export async function reviewFiles(tasks) {
  const review = tasks.filter((t) => ["completed", "client_rejected"].includes(t.status));
  if (!review.length) return {};
  const { data } = await db().from("task_files").select("task_id, revision, name, storage_path, url, created_at").in("task_id", review.map((t) => t.id)).eq("role", "deliverable").order("created_at");
  const rev = Object.fromEntries(review.map((t) => [t.id, t.revision]));
  const files = (data || []).filter((f) => f.revision === rev[f.task_id]);
  const paths = files.filter((f) => f.storage_path).map((f) => f.storage_path);
  let signed = {};
  if (paths.length) {
    const { data: s } = await db().storage.from("lead-docs").createSignedUrls(paths, 3600);
    signed = Object.fromEntries((s || []).filter((x) => x.signedUrl).map((x) => [x.path, x.signedUrl]));
  }
  const out = {};
  for (const f of files) (out[f.task_id] ||= []).push({ name: f.name, href: f.storage_path ? signed[f.storage_path] || "" : f.url });
  return out;
}
