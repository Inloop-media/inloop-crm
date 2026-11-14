import "server-only";
import { db } from "@/lib/supabase/server";
import { signDocs } from "@/lib/leads";
import { DEFAULT_TERMS, servicesFromCommercials } from "@/lib/mou";
import { pushTo } from "@/lib/push";
import { fullName } from "@/lib/format";
import { OPEN_TASK } from "@/lib/constants";

const LEAD_FIELDS = "id, code, first_name, last_name, email, phone, brand, service, budget, location";
const isUuid = (v) => /^[0-9a-f-]{36}$/i.test(String(v || ""));

/** Creates the brand (MOU draft) for a lead the first time it's needed. Safe to call again. */
export async function ensureBrand(leadId, actorId) {
  const { data: found } = await db().from("brands").select("*").eq("lead_id", leadId).maybeSingle();
  if (found) return found;
  const [{ data: lead }, { data: proposal }] = await Promise.all([
    db().from("leads").select(LEAD_FIELDS).eq("id", leadId).maybeSingle(),
    db().from("proposals").select("commercials").eq("lead_id", leadId).maybeSingle(),
  ]);
  if (!lead) return null;
  const row = {
    lead_id: leadId,
    name: lead.brand || fullName(lead),
    services: servicesFromCommercials(proposal?.commercials),
    terms: {
      ...DEFAULT_TERMS,
      client_legal_name: lead.brand || "",
      signatory_name: fullName(lead) === "—" ? "" : fullName(lead),
      client_email: lead.email || "",
      client_phone: lead.phone || "",
      client_address: lead.location || "",
    },
    created_by: actorId || null,
  };
  const { data, error } = await db().from("brands").insert(row).select("*").single();
  if (error) {
    // Two clicks at once: the other insert won
    const { data: again } = await db().from("brands").select("*").eq("lead_id", leadId).maybeSingle();
    return again;
  }
  return data;
}

/** The brand for a lead with its MOU documents (signed links), or null. */
export async function getBrandForLead(leadId) {
  const { data: brand, error } = await db().from("brands").select("*").eq("lead_id", leadId).maybeSingle();
  if (error || !brand) return null;
  const { data: docs } = await db()
    .from("lead_documents")
    .select("id, kind, name, storage_path, url, size, created_at")
    .eq("lead_id", leadId)
    .in("kind", ["mou", "mou_signed"])
    .order("created_at");
  return { ...brand, docs: await signDocs(docs || []) };
}

/** Task counts per brand: { [brandId]: { total, done, open, review, client, overdue } } */
async function taskCounts(brandIds) {
  if (!brandIds.length) return {};
  const { data } = await db().from("tasks").select("brand_id, status, due_at").in("brand_id", brandIds).limit(10000);
  const now = Date.now();
  const out = {};
  for (const t of data || []) {
    const c = (out[t.brand_id] ||= { total: 0, done: 0, open: 0, review: 0, client: 0, overdue: 0 });
    c.total += 1;
    if (t.status === "done") c.done += 1;
    else if (t.status === "sent_to_client") c.client += 1;
    else if (t.status === "completed" || t.status === "client_rejected") c.review += 1;
    else c.open += 1;
    if (OPEN_TASK.includes(t.status) && t.due_at && new Date(t.due_at).getTime() < now) c.overdue += 1;
  }
  return out;
}

/** Every brand with its lead and task counts, onboarded ones first. */
export async function listBrands() {
  const { data, error } = await db()
    .from("brands")
    .select(`id, name, stage, services, onboarded_at, mou_sent_at, created_at, lead:leads(${LEAD_FIELDS})`)
    .order("onboarded_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) return [];
  const counts = await taskCounts((data || []).map((b) => b.id));
  return (data || []).map((b) => ({ ...b, counts: counts[b.id] || { total: 0, done: 0, open: 0, review: 0, client: 0, overdue: 0 } }));
}

export async function getBrand(id) {
  if (!isUuid(id)) return null;
  const { data } = await db().from("brands").select(`*, lead:leads(${LEAD_FIELDS})`).eq("id", id).maybeSingle();
  return data || null;
}

/** Brand is signed: switch it on, tell everyone, and queue the pop-up. */
export async function onboardBrand(brand, actorId) {
  const now = new Date().toISOString();
  const { data: updated, error } = await db()
    .from("brands")
    .update({ stage: "active", signed_at: brand.signed_at || now, onboarded_at: now, updated_at: now })
    .eq("id", brand.id)
    .neq("stage", "active")
    .select("id")
    .maybeSingle();
  if (error || !updated) return { ok: false, error: error?.message || "Already onboarded." };
  await db().from("leads").update({ status: "Won", updated_at: now }).eq("id", brand.lead_id);
  const { title, body } = celebration(brand.name);
  await db().from("celebrations").insert({ brand_id: brand.id, title, body });
  const { data: everyone } = await db().from("members").select("id").eq("active", true);
  await pushTo((everyone || []).map((m) => m.id), { title, body, url: `/brands/${brand.id}`, tag: `onboard-${brand.id}` });
  return { ok: true, actorId };
}

export const celebration = (name) => ({
  title: `Welcome to the Loop, ${name}!`,
  body: `${name} is officially an Inloop client. Let's build something big.`,
});

/** Celebrations this member hasn't seen yet (newest first). */
export async function unseenCelebrations(me) {
  const { data: m } = await db().from("members").select("celebrations_seen_at").eq("id", me.id).maybeSingle();
  if (!m) return [];
  const { data } = await db()
    .from("celebrations")
    .select("id, title, body, created_at, brand_id")
    .gt("created_at", m.celebrations_seen_at)
    .order("created_at", { ascending: false })
    .limit(3);
  return data || [];
}
