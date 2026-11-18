import "server-only";
import { after } from "next/server";
import { db } from "@/lib/supabase/server";
import { pushTo } from "@/lib/push";
import { dmContacts } from "@/lib/dm";

// Requirements: someone asks their team lead or head for something and both sides track it.
// Who you can send one to: your head(s), your team lead(s), and — for heads — the other heads.
// The receiver can start it, finish it, say no, or pass it up (e.g. team lead → head). Both can add notes.

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
  return { items: data || [] };
}

export async function requirementCounts(meId) {
  const [inbox, sent] = await Promise.all([
    db().from("requirements").select("id", { count: "exact", head: true }).eq("to_id", meId).in("status", OPEN_REQ),
    db().from("requirements").select("id", { count: "exact", head: true }).eq("from_id", meId).in("status", OPEN_REQ),
  ]);
  return { inbox: inbox.error ? 0 : inbox.count || 0, sent: sent.error ? 0 : sent.count || 0 };
}

const clean = (v, max) => String(v ?? "").trim().slice(0, max);

export async function createRequirement(me, input) {
  const title = clean(input.title, 160);
  if (!title) return { ok: false, error: "Write what you need." };
  const to = await recipients(me);
  const target = to.find((r) => r.id === input.to_id);
  if (!target) return { ok: false, error: "Pick your team lead or head." };
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
  } else if (change.forward) {
    if (!receiver) return { ok: false, error: "Only the person it was sent to can pass it on." };
    const up = await recipients(me);
    const target = up.find((x) => x.id === change.forward);
    if (!target || target.id === r.from_id) return { ok: false, error: "You can pass it to your head or another head." };
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
