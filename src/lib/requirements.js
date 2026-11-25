import "server-only";
import { after } from "next/server";
import { db } from "@/lib/supabase/server";
import { pushTo } from "@/lib/push";
import { dmContacts } from "@/lib/dm";

// Requirements: someone asks their team lead (or their manager / CBO, e.g. when the team lead is off) for
// something and both sides track it. The receiver can start it, say no, pass it up, or upload the files /
// assets and submit — the requirement is then done and the files go back to the person who asked.

export const REQ_STATUSES = [
  { id: "open", label: "New", color: "#3b82f6" },
  { id: "in_progress", label: "Working on it", color: "#f59e0b" },
  { id: "done", label: "Done", color: "#10b981" },
  { id: "rejected", label: "Can't do", color: "#94a3b8" },
];
export const REQ_CATEGORIES = [
  { id: "equipment", label: "Equipment" },
  { id: "software", label: "Software / tool" },
  { id: "access", label: "Access / login" },
  { id: "assets", label: "Assets / content" },
  { id: "help", label: "Help / guidance" },
  { id: "other", label: "Other" },
];
export const OPEN_REQ = ["open", "in_progress"];
const isStaff = (m) => m.role === "admin" || m.role === "ops";
const BUCKET = "lead-docs";
export const REQ_MAX_FILE = 50 * 1024 * 1024;
const FIELDS = "*, from:members!requirements_from_id_fkey(id, name), to:members!requirements_to_id_fkey(id, name)";

/** People `me` can send a requirement to (heads and team leads above them; heads ↔ heads). */
export async function recipients(me) {
  return (await dmContacts(me)).filter((c) => c.rank <= 1).map(({ id, name, label }) => ({ id, name, label }));
}

/** box: "inbox" (sent to me) | "sent" (by me) | "all" (admin / ops) */
export async function listRequirements(me, box) {
  let q = db().from("requirements").select(FIELDS).order("created_at", { ascending: false }).limit(500);
  if (box === "all" && isStaff(me)) {
    /* everything */
  } else if (box === "sent") q = q.eq("from_id", me.id);
  else q = q.eq("to_id", me.id);
  const { data, error } = await q;
  if (error) return { items: [], missing: /requirements/.test(error.message) };
  return { items: (await signFiles(data || [])).map((r) => ({ ...r, unread: isUnread(r, me.id) })) };
}

/** Files delivered on a requirement are private: sign them for an hour (view + download links). */
async function signFiles(items) {
  const paths = [...new Set(items.flatMap((r) => (r.history || []).flatMap((h) => (h.files || []).map((f) => f.path))).filter(Boolean))];
  if (!paths.length) return items;
  const [{ data: view }, { data: down }] = await Promise.all([
    db().storage.from(BUCKET).createSignedUrls(paths, 3600),
    db().storage.from(BUCKET).createSignedUrls(paths, 3600, { download: true }),
  ]);
  const v = Object.fromEntries((view || []).filter((x) => x.signedUrl).map((x) => [x.path, x.signedUrl]));
  const d = Object.fromEntries((down || []).filter((x) => x.signedUrl).map((x) => [x.path, x.signedUrl]));
  return items.map((r) => ({
    ...r,
    history: (r.history || []).map((h) => (h.files ? { ...h, files: h.files.map((f) => ({ ...f, href: v[f.path] || "", download: d[f.path] || "" })) } : h)),
  }));
}

/** The receiver uploads a file for a requirement (signed upload URL, straight to storage). */
export async function reqUploadUrl(me, id, fileName, size) {
  const { data: r } = await db().from("requirements").select("id, to_id").eq("id", id).maybeSingle();
  if (!r) return { ok: false, error: "Requirement not found." };
  if (r.to_id !== me.id && !isStaff(me)) return { ok: false, error: "Only the person it was sent to can upload." };
  if (!(size > 0) || size > REQ_MAX_FILE) return { ok: false, error: "Files must be under 50 MB." };
  const safe = String(fileName || "file").trim().slice(0, 120).replace(/[^\w.\-]+/g, "_") || "file";
  const path = `req/${id}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${safe}`;
  const { data, error } = await db().storage.from(BUCKET).createSignedUploadUrl(path);
  if (error) return { ok: false, error: error.message };
  return { ok: true, path: data.path, token: data.token };
}

/** Something on this requirement happened after I last opened it, and it wasn't me who did it. */
export function isUnread(r, meId) {
  const last = [...(r.history || [])].reverse().find((h) => h.by && h.by !== meId);
  if (!last?.at) return false;
  if (r.from_id !== meId && r.to_id !== meId) return false;
  const seen = r.from_id === meId ? r.from_seen_at : r.to_seen_at;
  if (seen === undefined) return false; // before migration 033
  return !seen || last.at > seen;
}

/**
 * inbox: open ones sent to me · sent: open ones I asked for · badge: the sidebar number — open ones waiting
 * on me, plus anything with a reply / update I haven't opened yet (either side).
 */
export async function requirementCounts(meId) {
  const since = new Date(Date.now() - 60 * 864e5).toISOString();
  let { data, error } = await db()
    .from("requirements")
    .select("id, from_id, to_id, status, history, from_seen_at, to_seen_at")
    .or(`from_id.eq.${meId},to_id.eq.${meId}`)
    .gte("updated_at", since)
    .limit(500);
  // Open ones older than 60 days still count as waiting
  if (!error) {
    const { data: old } = await db().from("requirements").select("id, from_id, to_id, status").eq("to_id", meId).in("status", OPEN_REQ).lt("updated_at", since).limit(500);
    data = [...(data || []), ...(old || [])];
  }
  if (error && /seen_at/.test(error.message)) {
    // before migration 033 — just the open counts
    ({ data, error } = await db().from("requirements").select("id, from_id, to_id, status").or(`from_id.eq.${meId},to_id.eq.${meId}`).in("status", OPEN_REQ).limit(500));
  }
  if (error) return { inbox: 0, sent: 0, unread: 0, badge: 0 };
  const rows = data || [];
  const open = (r) => OPEN_REQ.includes(r.status);
  const inbox = rows.filter((r) => r.to_id === meId && open(r));
  const unread = rows.filter((r) => isUnread(r, meId));
  return {
    inbox: inbox.length,
    sent: rows.filter((r) => r.from_id === meId && open(r)).length,
    unread: unread.length,
    sentUnread: unread.filter((r) => r.from_id === meId).length,
    badge: new Set([...inbox, ...unread].map((r) => r.id)).size,
  };
}

/** I opened it: its replies / updates are read. */
export async function markRequirementSeen(me, id) {
  const { data: r } = await db().from("requirements").select("id, from_id, to_id").eq("id", id).maybeSingle();
  if (!r) return;
  const now = new Date().toISOString();
  if (r.from_id === me.id) await db().from("requirements").update({ from_seen_at: now }).eq("id", id);
  if (r.to_id === me.id) await db().from("requirements").update({ to_seen_at: now }).eq("id", id);
}

const clean = (v, max) => String(v ?? "").trim().slice(0, max);

export async function createRequirement(me, input) {
  const title = clean(input.title, 160);
  if (!title) return { ok: false, error: "Write what you need." };
  const to = await recipients(me);
  const target = to.find((r) => r.id === input.to_id);
  if (!target) return { ok: false, error: "Pick your team lead or manager." };
  const row = {
    title,
    details: clean(input.details, 4000),
    category: REQ_CATEGORIES.some((c) => c.id === input.category) ? input.category : "other",
    priority: ["high", "medium", "low"].includes(input.priority) ? input.priority : "medium",
    from_id: me.id,
    to_id: target.id,
    needed_by: /^\d{4}-\d{2}-\d{2}$/.test(input.needed_by || "") ? input.needed_by : null,
    history: [{ at: new Date().toISOString(), by: me.id, type: "created" }],
  };
  const { data, error } = await db().from("requirements").insert(row).select("id").single();
  if (error) return { ok: false, error: /requirements/.test(error.message) ? "Requirements aren't set up yet — run migration 019 in Supabase." : error.message };
  after(() => pushTo([target.id], { title: `${row.priority === "high" ? "🔴" : "📌"} ${me.name} needs something`, body: title, url: `/requirements?box=inbox&open=${data.id}`, tag: `req-${data.id}` }));
  return { ok: true, id: data.id };
}

const STATUS_PUSH = { in_progress: "⏳ Working on it", done: "✅ Done", rejected: "✖️ Can't do", open: "↩️ Reopened" };

/**
 * One change: { status } (receiver; requester may only reopen or withdraw), { forward: memberId } (receiver),
 * { note } (either side). Every change is added to the history and the other side is notified.
 */
export async function updateRequirement(me, id, change) {
  const { data: r } = await db().from("requirements").select("*").eq("id", id).maybeSingle();
  if (!r) return { ok: false, error: "Requirement not found." };
  const receiver = r.to_id === me.id || isStaff(me);
  const requester = r.from_id === me.id;
  if (!receiver && !requester) return { ok: false, error: "This isn't yours." };
  const now = new Date().toISOString();
  const patch = { updated_at: now };
  const event = { at: now, by: me.id };
  let notify = [];
  let push = null;
  const note = clean(change.note, 2000);

  if (change.status) {
    if (!REQ_STATUSES.some((s) => s.id === change.status)) return { ok: false, error: "Unknown status." };
    // The requester can withdraw (rejected) or reopen; everything else is the receiver's call
    if (!receiver && !(change.status === "rejected" || change.status === "open")) return { ok: false, error: "Only the person it was sent to can change this." };
    patch.status = change.status;
    patch.closed_at = OPEN_REQ.includes(change.status) ? null : now;
    Object.assign(event, { type: "status", status: change.status, ...(note ? { note } : {}) });
    notify = [requester && !receiver ? r.to_id : r.from_id];
    push = { title: `${STATUS_PUSH[change.status]}: ${r.title}`, body: note || `${me.name} updated your requirement` };
  } else if (change.deliver) {
    // Upload & submit: the files / links go back to the requester and the requirement is done
    if (!receiver) return { ok: false, error: "Only the person it was sent to can submit." };
    const prefix = `req/${r.id}/`;
    const files = (Array.isArray(change.deliver.files) ? change.deliver.files : [])
      .filter((f) => typeof f?.path === "string" && f.path.startsWith(prefix) && !f.path.includes(".."))
      .slice(0, 20)
      .map((f) => ({ path: f.path, name: clean(f.name || "file", 200), size: Number(f.size) || 0, type: clean(f.type, 100) }));
    const links = (Array.isArray(change.deliver.links) ? change.deliver.links : [])
      .map((l) => clean(l, 1000))
      .filter((l) => /^https?:\/\//i.test(l))
      .slice(0, 10);
    if (!files.length && !links.length) return { ok: false, error: "Upload a file or add a link first." };
    patch.status = "done";
    patch.closed_at = now;
    Object.assign(event, { type: "delivered", files, links, ...(note ? { note } : {}) });
    notify = [r.from_id];
    const what = files.length ? `${files.length} file${files.length > 1 ? "s" : ""}` : "a link";
    push = { title: `📦 ${me.name} sent you ${what}`, body: r.title };
  } else if (change.forward) {
    if (!receiver) return { ok: false, error: "Only the person it was sent to can pass it on." };
    const up = await recipients(me);
    const target = up.find((x) => x.id === change.forward);
    if (!target || target.id === r.from_id) return { ok: false, error: "You can pass it to your manager or another manager." };
    patch.to_id = target.id;
    Object.assign(event, { type: "forward", to: target.id, ...(note ? { note } : {}) });
    notify = [target.id, r.from_id];
    push = { title: `📌 ${me.name} passed you a requirement`, body: r.title };
  } else if (note) {
    Object.assign(event, { type: "note", note });
    notify = [r.from_id === me.id ? r.to_id : r.from_id];
    push = { title: `💬 ${me.name} on "${r.title}"`, body: note };
  } else return { ok: false, error: "Nothing to change." };

  patch.history = [...(r.history || []), event];
  const { error } = await db().from("requirements").update(patch).eq("id", id);
  if (error) return { ok: false, error: error.message };
  if (push) after(() => pushTo(notify.filter((x) => x && x !== me.id), { ...push, body: String(push.body).slice(0, 140), url: `/requirements?open=${id}`, tag: `req-${id}` }));
  return { ok: true };
}

/** Names for the people in histories. */
export async function memberNames(ids) {
  const list = [...new Set(ids.filter(Boolean))];
  if (!list.length) return {};
  const { data } = await db().from("members").select("id, name").in("id", list);
  return Object.fromEntries((data || []).map((m) => [m.id, m.name]));
}
