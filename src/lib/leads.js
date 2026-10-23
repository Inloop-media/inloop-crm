import "server-only";
import { db } from "@/lib/supabase/server";
import { canSeeAllLeads, canSeeLead } from "@/lib/permissions";

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
  return { ...lead, events: events || [] };
}

export async function listMembers({ activeOnly = false } = {}) {
  let query = db().from("members").select("*").order("name");
  if (activeOnly) query = query.eq("active", true);
  const { data } = await query;
  return data || [];
}

export async function addEvents(leadId, actorId, events) {
  if (!events.length) return;
  await db()
    .from("lead_events")
    .insert(events.map((e) => ({ lead_id: leadId, actor_id: actorId || null, type: e.type, data: e.data || {} })));
}
