import "server-only";
import { db } from "@/lib/supabase/server";
import { pushTo } from "@/lib/push";
import { MAKER_KINDS, OPEN_TASK, taskKindLabel } from "@/lib/constants";
import { canAssignTasks, canSeeTask } from "@/lib/permissions";

export const TASK_FIELDS =
  "id, brand_id, title, kind, brief, assignee_id, assigned_by, due_at, status, revision, feedback, completed_at, done_at, created_at, updated_at, " +
  "brand:brands(id, name, lead_id), assignee:members!tasks_assignee_id_fkey(id, name), assigner:members!tasks_assigned_by_fkey(id, name)";

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
  return { ...t, files: (files || []).map((f) => ({ ...f, href: f.storage_path ? signed[f.storage_path] || "" : f.url })), events: events || [] };
}

/** People who can take tasks: active members of the designer / developer / video groups (and heads). */
export async function listMakers() {
  const { data } = await db()
    .from("groups")
    .select("kind, group_members(member:members(id, name, active))")
    .in("kind", [...MAKER_KINDS, "execution"]);
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
