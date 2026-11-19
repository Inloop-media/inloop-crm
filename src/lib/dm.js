import "server-only";
import { after } from "next/server";
import { db } from "@/lib/supabase/server";
import { pushTo } from "@/lib/push";
import { addEvents } from "@/lib/leads";
import { headIdsOf, isOperationsGroup, ownHeadIds, runnersOf, teamLeadIdsOf } from "@/lib/groups";
import { leadName, leadProblem, normalizeLead } from "@/lib/leadShare";

// Direct messages inside the team. Who can talk to whom:
//   • a person ↔ the manager of any group they are in (or its CBO when it has no manager)
//   • a person ↔ their group's team leads (picked by the CBO, e.g. the senior designer)
//   • a person ↔ the CBO their group comes under
//   • managers / CBOs ↔ each other
//   • admin / ops ↔ anyone, and anyone can reply to someone who already wrote to them
// Live updates: a Realtime broadcast on `dm-{memberId}` that only says "something changed"; the page then
// reloads through its permission-checked server action (same pattern as the client chat).

const BUCKET = "lead-docs";
const MAX_TEXT = 4000;
export const DM_MAX_FILE = 50 * 1024 * 1024;
const isStaff = (m) => m.role === "admin" || m.role === "ops";
const ROLE = { admin: "Admin", ops: "Ops" };

/** Tell these members' open pages that something changed. Never throws. */
async function ping(memberIds, event, payload = {}) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [...new Set(memberIds)].map((id) => ({ topic: `dm-${id}`, event, payload })) }),
    });
  } catch {}
}

/** Everyone `me` can message: [{ id, name, label }] — heads first, then their team, then the rest. */
export async function dmContacts(me) {
  const [{ data: people }, groupsRes, { data: wrote }] = await Promise.all([
    db().from("members").select("id, name, role").eq("active", true),
    db().from("groups").select("*, group_members(member_id)"),
    db().from("direct_messages").select("from_id").eq("to_id", me.id).limit(1000),
  ]);
  const groups = groupsRes.error ? [] : groupsRes.data || []; // before migration 015 there are no heads
  const byId = new Map((people || []).map((p) => [p.id, p]));
  const out = new Map();
  const add = (id, label, rank) => {
    if (!id || id === me.id || !byId.has(id)) return;
    const cur = out.get(id);
    if (!cur || rank < cur.rank) out.set(id, { id, name: byId.get(id).name, label, rank });
  };
  const ledBy = {}; // head id → names of the groups they run
  for (const g of groups) for (const h of runnersOf(g)) (ledBy[h] ||= []).push(g.name);
  const cbos = new Set(groups.filter(isOperationsGroup).flatMap(headIdsOf));
  const headLabel = (id) => (cbos.has(id) ? "CBO" : `Manager · ${ledBy[id].join(", ")}`);
  for (const g of groups) {
    const ids = (g.group_members || []).map((x) => x.member_id);
    const heads = headIdsOf(g);
    const leads = teamLeadIdsOf(g);
    const inIt = ids.includes(me.id) || leads.includes(me.id);
    // the group's heads, and the CBO it comes under
    // a group with no manager of its own is managed by its CBO
    if (inIt) for (const h of heads) add(h, isOperationsGroup(g) || !ownHeadIds(g).length ? `CBO · ${g.name}` : `Your manager · ${g.name}`, 0);
    if (inIt && g.owner_id && !heads.includes(g.owner_id)) add(g.owner_id, `CBO · ${g.name}`, 0);
    if (ids.includes(me.id)) for (const t of leads) add(t, `Team lead · ${g.name}`, 1);
    if (runnersOf(g).includes(me.id) || leads.includes(me.id)) {
      for (const id of ids) add(id, leads.includes(id) ? `Team lead · ${g.name}` : g.name, leads.includes(id) ? 1 : 2);
      if (runnersOf(g).includes(me.id)) for (const h of heads) add(h, isOperationsGroup(g) ? "CBO" : `Manager · ${g.name}`, 0);
    }
  }
  // CBO comes under the admins: its heads and members can message them (and send them requirements)
  if (groups.some((g) => isOperationsGroup(g) && (runnersOf(g).includes(me.id) || (g.group_members || []).some((x) => x.member_id === me.id))))
    for (const p of people || []) if (p.role === "admin") add(p.id, "Admin", 0);
  if (ledBy[me.id]) for (const id of Object.keys(ledBy)) add(id, headLabel(id), 0);
  if (isStaff(me)) for (const p of people || []) add(p.id, ROLE[p.role] || (ledBy[p.id] ? headLabel(p.id) : "Team"), 3);
  for (const w of wrote || []) add(w.from_id, ROLE[byId.get(w.from_id)?.role] || (ledBy[w.from_id] ? headLabel(w.from_id) : "Team"), 3);
  return [...out.values()].sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));
}

export async function canMessage(me, otherId) {
  return (await dmContacts(me)).some((c) => c.id === otherId);
}

const pairFilter = (a, b) => `and(from_id.eq.${a},to_id.eq.${b}),and(from_id.eq.${b},to_id.eq.${a})`;

/** The conversation between me and other, oldest first, files signed for an hour. */
export async function loadConversation(meId, otherId, limit = 400) {
  const { data, error } = await db()
    .from("direct_messages")
    .select("id, from_id, to_id, body, attachments, kind, meta, read_at, created_at")
    .or(pairFilter(meId, otherId))
    .order("created_at", { ascending: false })
    .limit(limit);
  const messages = error ? [] : (data || []).reverse();
  const paths = messages.flatMap((m) => (m.attachments || []).map((a) => a.path)).filter(Boolean);
  let signed = {};
  if (paths.length) {
    const { data: urls } = await db().storage.from(BUCKET).createSignedUrls(paths, 3600);
    signed = Object.fromEntries((urls || []).filter((x) => x.signedUrl).map((x) => [x.path, x.signedUrl]));
  }
  for (const m of messages) m.attachments = (m.attachments || []).map((a) => ({ ...a, href: signed[a.path] || "" }));
  return messages;
}

/** Per person I talk to: { [otherId]: { last, unread } }. */
export async function threads(meId) {
  const { data, error } = await db()
    .from("direct_messages")
    .select("from_id, to_id, body, kind, meta, attachments, read_at, created_at")
    .or(`from_id.eq.${meId},to_id.eq.${meId}`)
    .order("created_at", { ascending: false })
    .limit(2000);
  if (error) return {};
  const out = {};
  for (const m of data || []) {
    const other = m.from_id === meId ? m.to_id : m.from_id;
    const t = (out[other] ||= { last: m, unread: 0 });
    if (m.to_id === meId && !m.read_at) t.unread++;
  }
  return out;
}

/** Unread direct messages for the sidebar badge. */
export async function dmUnread(meId) {
  const { count, error } = await db().from("direct_messages").select("id", { count: "exact", head: true }).eq("to_id", meId).is("read_at", null);
  return error ? 0 : count || 0;
}

export async function markRead(meId, otherId) {
  const at = new Date().toISOString();
  const { data } = await db().from("direct_messages").update({ read_at: at }).eq("from_id", otherId).eq("to_id", meId).is("read_at", null).select("id");
  if (data?.length) await ping([otherId], "read", { by: meId, at });
}

const pairKey = (a, b) => [a, b].sort().join("_");

export async function uploadUrl(meId, otherId, fileName, size) {
  if (!(size > 0) || size > DM_MAX_FILE) return { ok: false, error: "Files must be under 50 MB." };
  const safe = String(fileName || "file").trim().slice(0, 120).replace(/[^\w.\-]+/g, "_") || "file";
  const path = `dm/${pairKey(meId, otherId)}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${safe}`;
  const { data, error } = await db().storage.from(BUCKET).createSignedUploadUrl(path);
  if (error) return { ok: false, error: error.message };
  return { ok: true, path: data.path, token: data.token };
}

const clean = (v, max) => String(v ?? "").trim().slice(0, max);

/** Saves a message (text, files, or a lead card), updates both sides, and notifies the receiver. */
export async function send(me, otherId, { body, attachments, lead }) {
  const text = clean(body, MAX_TEXT);
  const prefix = `dm/${pairKey(me.id, otherId)}/`;
  const files = (Array.isArray(attachments) ? attachments : [])
    .filter((a) => typeof a?.path === "string" && a.path.startsWith(prefix) && !a.path.includes(".."))
    .slice(0, 10)
    .map((a) => ({ path: a.path, name: clean(a.name || "file", 200), size: Number(a.size) || 0, type: clean(a.type, 100) }));
  let kind = "text";
  let meta = {};
  if (lead) {
    meta = normalizeLead(lead);
    const problem = leadProblem(meta);
    if (problem) return { ok: false, error: problem };
    kind = "lead";
  } else if (!text && !files.length) return { ok: false, error: "Write a message first." };

  const { data, error } = await db()
    .from("direct_messages")
    .insert({ from_id: me.id, to_id: otherId, body: text, attachments: files, kind, meta })
    .select("id, created_at")
    .single();
  if (error) return { ok: false, error: /direct_messages/.test(error.message) ? "Direct messages aren't set up yet — run migration 018 in Supabase." : error.message };
  // Writing to someone means you've read what they sent
  await db().from("direct_messages").update({ read_at: data.created_at }).eq("from_id", otherId).eq("to_id", me.id).is("read_at", null);
  await ping([otherId, me.id], "msg", { from: me.id });
  after(() =>
    pushTo([otherId], {
      title: kind === "lead" ? `🟢 ${me.name} shared a lead` : me.name,
      body: (kind === "lead" ? `${meta.brand || leadName(meta)}${meta.service ? ` · ${meta.service}` : ""}` : text || (files.length === 1 ? `📎 ${files[0].name}` : `📎 ${files.length} files`)).slice(0, 140),
      url: `/dm?with=${me.id}`,
      tag: `dm-${me.id}`,
    })
  );
  return { ok: true, id: data.id };
}

/**
 * Publishes a lead card as a real lead in the CRM. The sales head may correct the fields first (`edits`)
 * and pick who gets it (`assignee`: a member id, "" for nobody; left out → the person who shared it, if
 * they're in sales). Callers check that `me` may give leads to that person.
 */
export async function addSharedLead(me, messageId, edits = null, assignee) {
  const { data: m } = await db().from("direct_messages").select("*").eq("id", messageId).maybeSingle();
  if (!m || m.kind !== "lead") return { ok: false, error: "That isn't a lead card." };
  if (m.to_id !== me.id && !isStaff(me)) return { ok: false, error: "Only the person it was shared with can publish it." };
  if (m.meta?.lead_id) return { ok: false, error: `Already published as ${m.meta.lead_code || "a lead"}.` };
  const fields = normalizeLead({ ...(m.meta || {}), ...(edits || {}) });
  const problem = leadProblem(fields);
  if (problem) return { ok: false, error: problem };
  const { data: sharer } = await db().from("members").select("id, name, active, group_members(group:groups(kind))").eq("id", m.from_id).maybeSingle();
  const salesPerson = async (id) => {
    if (!id) return false;
    const { data } = await db().from("members").select("id, active, group_members(group:groups(kind))").eq("id", id).maybeSingle();
    return !!data?.active && (data.group_members || []).some((g) => g.group?.kind === "sales");
  };
  const to = assignee === undefined ? ((await salesPerson(sharer?.id)) ? sharer.id : null) : assignee || null;
  if (to && !(await salesPerson(to))) return { ok: false, error: "Leads can only go to active members of a sales group." };
  const row = { ...fields, ...(to ? { assigned_to: to, assigned_at: new Date().toISOString() } : {}) };
  const { data: lead, error } = await db().from("leads").insert(row).select("id, code").single();
  if (error) return { ok: false, error: error.message };
  await addEvents(lead.id, me.id, [{ type: "created", data: { source: `${fields.source} · shared by ${sharer?.name || "the team"}` } }]);
  await db().from("direct_messages").update({ meta: { ...fields, lead_id: lead.id, lead_code: lead.code, published_by: me.name } }).eq("id", m.id);
  await ping([m.from_id, m.to_id], "msg", { from: me.id });
  const tell = [...new Set([m.from_id, to].filter((x) => x && x !== me.id))];
  after(() =>
    pushTo(tell, {
      title: to && to !== m.from_id ? `✅ ${me.name} published a lead (${lead.code})` : `✅ ${me.name} published your lead (${lead.code})`,
      body: fields.brand || leadName(fields),
      url: `/leads/${lead.id}`,
      tag: `lead-${lead.id}`,
    })
  );
  return { ok: true, id: lead.id, code: lead.code };
}
