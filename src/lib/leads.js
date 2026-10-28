import "server-only";
import { db } from "@/lib/supabase/server";
import { MEMBER_FIELDS } from "@/lib/auth";
import { CLOSED_STATUSES } from "@/lib/constants";
import { canSeeAllLeads, canSeeLead, canSeeMeetingKind, canSeeProposal } from "@/lib/permissions";

const CARD_FIELDS =
  "id, code, lead_no, first_name, last_name, email, phone, brand, service, budget, location, status, assigned_to, assigned_at, created_at, updated_at";

// PostgREST filter syntax uses , ( ) — strip them (and wildcards) from search text
const clean = (q) => String(q || "").replace(/[%*,()\\:]/g, " ").trim().slice(0, 80);

/** Leads this member may see, newest first. */
export async function listLeads(me, { q, owner, status } = {}) {
  let query = db().from("leads").select(CARD_FIELDS).order("created_at", { ascending: false }).limit(1000);

  if (!canSeeAllLeads(me)) query = query.eq("assigned_to", me.id);
  else if (owner === "unassigned") query = query.is("assigned_to", null);
  else if (owner) query = query.eq("assigned_to", owner);

  if (status) query = query.eq("status", status);

  const s = clean(q);
  if (s) {
    const like = `%${s}%`;
    query = query.or(
      ["code", "first_name", "last_name", "brand", "email", "phone", "location"].map((f) => `${f}.ilike.${like}`).join(",")
    );
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || [];
}

/** One lead with its history, or null if it doesn't exist / isn't visible to this member. */
export async function getLead(me, id) {
  if (!/^[0-9a-f-]{36}$/i.test(String(id))) return null;
  const { data: lead } = await db().from("leads").select("*").eq("id", id).maybeSingle();
  if (!lead || !canSeeLead(me, lead)) return null;
  const { data: events } = await db()
    .from("lead_events")
    .select("id, type, data, created_at, actor:members(name)")
    .eq("lead_id", id)
    .order("created_at", { ascending: false })
    .limit(200);
  const [meetings, proposal] = await Promise.all([
    listMeetings(me, { leadId: id }),
    canSeeAllLeads(me) ? getProposal(me, id) : null,
  ]);
  // Executives never see the ops team's proposal meetings or the proposal work, in the list or in the history
  const visible = (events || []).filter(
    (e) => canSeeAllLeads(me) || (!e.type.startsWith("proposal") && (!e.type.startsWith("meeting") || canSeeMeetingKind(me, e.data?.kind)))
  );
  return { ...lead, events: visible, meetings, proposal };
}

/** Team members with their groups ([{ id, name, kind }]). */
export async function listMembers({ activeOnly = false } = {}) {
  let query = db().from("members").select(`${MEMBER_FIELDS}, group_members(group:groups(id, name, kind))`).order("name");
  if (activeOnly) query = query.eq("active", true);
  const { data, error } = await query;
  if (error) {
    // Before supabase/migrations/002 + 003 are run
    let base = db().from("members").select("id, email, name, role, active, created_at").order("name");
    if (activeOnly) base = base.eq("active", true);
    return ((await base).data || []).map((m) => ({ ...m, groups: [] }));
  }
  return (data || []).map(({ group_members, ...m }) => ({ ...m, groups: (group_members || []).map((g) => g.group).filter(Boolean) }));
}

/** Active members a lead can be assigned to: everyone in a sales group. */
export async function listAssignees() {
  return (await listMembers({ activeOnly: true })).filter((m) => m.groups.some((g) => g.kind === "sales"));
}

export async function listGroups() {
  const { data, error } = await db()
    .from("groups")
    .select("id, name, kind, notify, created_at, group_members(member:members(id, name, email, active))")
    .order("created_at");
  if (error) return [];
  return (data || []).map(({ group_members, ...g }) => ({ ...g, members: (group_members || []).map((x) => x.member).filter(Boolean) }));
}

export async function addEvents(leadId, actorId, events) {
  if (!events.length) return;
  await db()
    .from("lead_events")
    .insert(events.map((e) => ({ lead_id: leadId, actor_id: actorId || null, type: e.type, data: e.data || {} })));
}

const MEETING_FIELDS =
  "id, lead_id, kind, starts_at, ends_at, meet_link, attendees, cancelled_at, created_at, organizer:members(id, name)";

/** Meetings this member may see — for one lead, or upcoming across their leads. Cancelled ones are left out. */
export async function listMeetings(me, { leadId, from, to } = {}) {
  let query = db()
    .from("meetings")
    .select(`${MEETING_FIELDS}, lead:leads!inner(id, code, brand, first_name, last_name, assigned_to)`)
    .is("cancelled_at", null)
    .order("starts_at", { ascending: !leadId })
    .limit(200);
  if (leadId) query = query.eq("lead_id", leadId);
  if (from) query = query.gte("starts_at", from);
  if (to) query = query.lt("starts_at", to);
  if (!canSeeAllLeads(me)) query = query.eq("kind", "discovery").eq("lead.assigned_to", me.id);
  const { data, error } = await query;
  if (error) {
    // The meetings table is added by supabase/migrations/002_meetings.sql — until then, show none
    if (/meetings/.test(error.message)) return [];
    throw new Error(error.message);
  }
  const now = Date.now();
  return (data || [])
    .filter((m) => canSeeMeetingKind(me, m.kind))
    .map((m) => ({ ...m, past: new Date(m.ends_at).getTime() < now }));
}

/** Everything the dashboard needs, limited to what this member may see. */
export async function dashboardData(me) {
  let query = db()
    .from("leads")
    .select("id, code, first_name, last_name, brand, service, source, status, assigned_to, budget, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(5000);
  if (!canSeeAllLeads(me)) query = query.eq("assigned_to", me.id);

  const since = new Date(Date.now() - 90 * 864e5).toISOString();
  let activity = db()
    .from("lead_events")
    .select("id, type, data, created_at, actor:members(name), lead:leads!inner(id, code, brand, first_name, last_name, assigned_to)")
    .order("created_at", { ascending: false })
    .limit(30);
  if (!canSeeAllLeads(me)) {
    // Executives: their own leads. Strategists: also the proposal steps on briefs they picked up.
    const { data: mine } = await db().from("proposals").select("lead_id").eq("strategist_id", me.id);
    const briefIds = (mine || []).map((p) => p.lead_id);
    activity = briefIds.length
      ? activity.or(`assigned_to.eq.${me.id},id.in.(${briefIds.join(",")})`, { referencedTable: "lead" })
      : activity.eq("lead.assigned_to", me.id);
  }

  const [{ data: leads, error }, upcoming, recentMeetings, members, proposals, { data: events }] = await Promise.all([
    query,
    listMeetings(me, { from: new Date().toISOString() }),
    listMeetings(me, { from: since }),
    listMembers({ activeOnly: true }),
    listProposals(me),
    activity,
  ]);
  if (error) throw new Error(error.message);
  // Same rule as the lead history: executives don't see proposal work or proposal meetings
  const visibleEvents = (events || []).filter((e) => {
    if (canSeeAllLeads(me)) return true;
    if (e.lead.assigned_to !== me.id) return e.type.startsWith("proposal"); // a strategist's brief
    return !e.type.startsWith("proposal") && (!e.type.startsWith("meeting") || canSeeMeetingKind(me, e.data?.kind));
  });
  return { leads: leads || [], upcoming, meetings: recentMeetings, members, proposals, activity: visibleEvents, now: Date.now() };
}

/* --------------------------- Proposal pipeline --------------------------- */

const BRIEF_LEAD_FIELDS = "id, code, first_name, last_name, brand, service, budget, location, details, brief, status, assigned_to";

/** Files stay private in the lead-docs bucket; links to them work for an hour. */
export async function signDocs(docs) {
  const paths = docs.filter((d) => d.storage_path).map((d) => d.storage_path);
  let signed = {};
  if (paths.length) {
    const { data } = await db().storage.from("lead-docs").createSignedUrls(paths, 3600);
    signed = Object.fromEntries((data || []).filter((x) => x.signedUrl).map((x) => [x.path, x.signedUrl]));
  }
  return docs.map((d) => ({ ...d, href: d.storage_path ? signed[d.storage_path] || "" : d.url }));
}

/** The proposal for a lead with its lead summary, documents and latest jobs — or null if not visible. */
export async function getProposal(me, leadId) {
  if (!/^[0-9a-f-]{36}$/i.test(String(leadId))) return null;
  const { data: p, error } = await db()
    .from("proposals")
    .select(`*, strategist:members!proposals_strategist_id_fkey(id, name), lead:leads(${BRIEF_LEAD_FIELDS})`)
    .eq("lead_id", leadId)
    .maybeSingle();
  if (error || !p || !canSeeProposal(me, p)) return null;
  const [{ data: docs }, { data: jobs }] = await Promise.all([
    db().from("lead_documents").select("id, kind, name, storage_path, url, size, created_at, uploader:members(name)").eq("lead_id", leadId).order("created_at"),
    db().from("jobs").select("id, type, status, progress, error, attempts, created_at, started_at, finished_at").eq("lead_id", leadId).order("created_at", { ascending: false }).limit(10),
  ]);
  return { ...p, docs: await signDocs(docs || []), jobs: jobs || [] };
}

/** Briefs for the strategist board: unclaimed ones + the member's own (everything for admin / ops). */
export async function listProposals(me) {
  const { data, error } = await db()
    .from("proposals")
    .select(`*, strategist:members!proposals_strategist_id_fkey(id, name), lead:leads(${BRIEF_LEAD_FIELDS})`)
    .order("shared_at", { ascending: false })
    .limit(500);
  if (error) return [];
  return (data || []).filter((p) => canSeeProposal(me, p));
}

/* ----------------------------- Group updates ----------------------------- */

/** Groups whose feed this member can read (their own; admin / ops see every group), with unread counts. */
export async function listFeeds(me) {
  let q = db().from("groups").select("id, name, kind, notify").order("created_at");
  if (!canSeeAllLeads(me)) {
    const ids = (me.groups || []).map((g) => g.id);
    if (!ids.length) return [];
    q = q.in("id", ids);
  }
  const [{ data: groups, error }, { data: reads }] = await Promise.all([
    q,
    db().from("group_reads").select("group_id, read_at").eq("member_id", me.id),
  ]);
  if (error) return []; // before supabase/migrations/004_group_updates.sql
  const readAt = Object.fromEntries((reads || []).map((r) => [r.group_id, r.read_at]));
  return Promise.all(
    (groups || []).map(async (g) => {
      let c = db().from("group_posts").select("id", { count: "exact", head: true }).eq("group_id", g.id);
      if (readAt[g.id]) c = c.gt("created_at", readAt[g.id]);
      const { count } = await c;
      return { ...g, unread: count || 0 };
    })
  );
}

export async function listGroupPosts(groupId) {
  const { data } = await db()
    .from("group_posts")
    .select("id, event, title, body, url, created_at, lead:leads(id, code, brand)")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false })
    .limit(200);
  return data || [];
}

export async function markGroupRead(groupId, memberId) {
  await db().from("group_reads").upsert({ group_id: groupId, member_id: memberId, read_at: new Date().toISOString() });
}

/** { memberId: number of open leads } — shown next to each executive when assigning. */
export async function openLeadCounts() {
  const { data } = await db().from("leads").select("assigned_to, status").not("assigned_to", "is", null).limit(5000);
  const counts = {};
  for (const l of data || []) if (!CLOSED_STATUSES.includes(l.status)) counts[l.assigned_to] = (counts[l.assigned_to] || 0) + 1;
  return counts;
}
