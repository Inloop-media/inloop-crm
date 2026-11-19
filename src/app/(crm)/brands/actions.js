"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { requireMember } from "@/lib/auth";
import { db } from "@/lib/supabase/server";
import { addEvents } from "@/lib/leads";
import { ensureBrand, getBrand, onboardBrand } from "@/lib/brands";
import { onboardLead, resetClientPassword } from "@/lib/clients";
import { BILLING, DEFAULT_TERMS, buildMouPdf } from "@/lib/mou";
import { canOnboard, canSeeBrands } from "@/lib/permissions";
import { chatUploadUrl, loadChat, markRead, postMessage } from "@/lib/chat";

const str = (v, max = 2000) => String(v ?? "").trim().slice(0, max);
const BUCKET = "lead-docs";
const MAX_FILE = 25 * 1024 * 1024;

function refresh(brand) {
  revalidatePath(`/leads/${brand.lead_id}`);
  revalidatePath("/brands");
  revalidatePath(`/brands/${brand.id}`);
  revalidatePath("/");
}

async function staffBrand(brandId) {
  const me = await requireMember();
  if (!canOnboard(me)) return { error: "Only admin / ops can handle onboarding." };
  const brand = await getBrand(brandId);
  if (!brand) return { error: "Brand not found." };
  return { me, brand };
}

/** Lead → brand with an MOU draft (also happens automatically when a lead is marked Won). */
export async function startOnboarding(leadId) {
  const me = await requireMember();
  if (!canOnboard(me)) return { ok: false, error: "Only admin / ops can start onboarding." };
  const brand = await ensureBrand(leadId, me.id);
  if (!brand) return { ok: false, error: "Lead not found." };
  await addEvents(leadId, me.id, [{ type: "onboarding_started", data: {} }]);
  refresh(brand);
  return { ok: true };
}

/** Save the MOU details: services table + terms. */
export async function saveMou(brandId, { name, services, terms }) {
  const { me, brand, error } = await staffBrand(brandId);
  if (error) return { ok: false, error };
  if (brand.stage === "active") return { ok: false, error: "This brand is already onboarded." };
  const rows = (Array.isArray(services) ? services : [])
    .map((s) => ({ name: str(s.name, 120), scope: str(s.scope, 400), fee: str(s.fee, 40), billing: BILLING.includes(s.billing) ? s.billing : "Monthly" }))
    .filter((s) => s.name)
    .slice(0, 20);
  const t = Object.fromEntries(Object.keys(DEFAULT_TERMS).map((k) => [k, str(terms?.[k], k === "notes" || k === "payment_terms" ? 2000 : 300)]));
  if (t.client_email && !/^\S+@\S+\.\S+$/.test(t.client_email)) return { ok: false, error: "The client's login email doesn't look right." };
  const { error: upErr } = await db()
    .from("brands")
    .update({ name: str(name, 120) || brand.name, services: rows, terms: t, updated_at: new Date().toISOString() })
    .eq("id", brandId);
  if (upErr) return { ok: false, error: upErr.message };
  refresh(brand);
  return { ok: true, by: me.id };
}

/**
 * Freeze the MOU as a PDF (kept on the lead) and mark it sent. Arushi mails the PDF to the client;
 * once Gmail is connected the CRM sends it and watches the thread for the signed copy.
 */
export async function markMouSent(brandId) {
  const { me, brand, error } = await staffBrand(brandId);
  if (error) return { ok: false, error };
  if (brand.stage === "active") return { ok: false, error: "This brand is already onboarded." };
  if (!(brand.services || []).length) return { ok: false, error: "Add at least one service to the MOU first." };
  if (!brand.terms?.client_email) return { ok: false, error: "Add the client's login email — the dashboard login goes there." };
  const version = (brand.mou_version || 0) + 1;
  const bytes = await buildMouPdf({ brand: { ...brand, mou_version: version }, lead: brand.lead, crmUrl: process.env.CRM_URL || "https://inloop-crm.vercel.app" });
  const safe = brand.name.replace(/[^\w]+/g, "_").slice(0, 60) || "Client";
  const name = `MOU_${safe}_x_Inloop_v${version}.pdf`;
  const path = `${brand.lead.code}/mou/${Date.now()}-${name}`;
  const { error: upErr } = await db().storage.from(BUCKET).upload(path, Buffer.from(bytes), { contentType: "application/pdf" });
  if (upErr) return { ok: false, error: upErr.message };
  await db().from("lead_documents").insert({ lead_id: brand.lead_id, kind: "mou", name, storage_path: path, size: bytes.length, uploaded_by: me.id });
  const now = new Date().toISOString();
  await db().from("brands").update({ stage: "mou_sent", mou_version: version, mou_sent_at: now, updated_at: now }).eq("id", brandId);
  await addEvents(brand.lead_id, me.id, [{ type: "mou_sent", data: { version } }]);
  refresh(brand);
  return { ok: true };
}

/** Back to editing (e.g. the client wants a change before signing). */
export async function reopenMou(brandId) {
  const { brand, error } = await staffBrand(brandId);
  if (error) return { ok: false, error };
  if (brand.stage !== "mou_sent") return { ok: false, error: "Nothing to reopen." };
  await db().from("brands").update({ stage: "mou_draft", updated_at: new Date().toISOString() }).eq("id", brandId);
  refresh(brand);
  return { ok: true };
}

/** Upload URL for the signed MOU the client mailed back. */
export async function startSignedUpload(brandId, fileName, size, type) {
  const { brand, error } = await staffBrand(brandId);
  if (error) return { ok: false, error };
  if (!(size > 0) || size > MAX_FILE) return { ok: false, error: "The file must be under 25 MB." };
  if (!/\.(pdf|jpe?g|png)$/i.test(fileName) && !/pdf|image/.test(type || "")) return { ok: false, error: "Upload the signed MOU as a PDF or a photo." };
  const safe = str(fileName, 120).replace(/[^\w.\-]+/g, "_") || "signed.pdf";
  const path = `${brand.lead.code}/mou_signed/${Date.now()}-${safe}`;
  const { data, error: e } = await db().storage.from(BUCKET).createSignedUploadUrl(path);
  if (e) return { ok: false, error: e.message };
  return { ok: true, path: data.path, token: data.token };
}

/** The client signed: keep the signed copy, onboard the brand, celebrate. */
export async function confirmSigned(brandId, file) {
  const { me, brand, error } = await staffBrand(brandId);
  if (error) return { ok: false, error };
  if (brand.stage === "active") return { ok: false, error: "Already onboarded." };
  if (brand.stage !== "mou_sent") return { ok: false, error: "Mark the MOU as sent first." };
  if (file?.path) {
    if (!String(file.path).startsWith(`${brand.lead.code}/mou_signed/`)) return { ok: false, error: "Upload not recognised." };
    await db().from("lead_documents").insert({ lead_id: brand.lead_id, kind: "mou_signed", name: str(file.name, 200), storage_path: file.path, size: Number(file.size) || 0, uploaded_by: me.id });
  }
  const res = await onboardBrand(brand, me.id);
  if (!res.ok) return res;
  await addEvents(brand.lead_id, me.id, [{ type: "onboarded", data: { brand: brand.name } }]);
  after(() => revalidatePath("/", "layout"));
  refresh(brand);
  return { ok: true };
}

/** The pop-up was shown: don't show these again to this member. */
export async function dismissCelebrations() {
  const me = await requireMember();
  await db().from("members").update({ celebrations_seen_at: new Date().toISOString() }).eq("id", me.id);
  return { ok: true };
}

/** Onboard now (for a Won lead from before this existed, or if the login couldn't be made the first time). */
export async function onboardNow(leadId) {
  const me = await requireMember();
  if (!canOnboard(me)) return { ok: false, error: "Only admin / ops can onboard a client." };
  const res = await onboardLead(leadId, me.id);
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/brands");
  revalidatePath("/", "layout");
  return res.ok ? { ok: true } : res;
}

export async function newClientPassword(brandId) {
  const { brand, error } = await staffBrand(brandId);
  if (error) return { ok: false, error };
  const res = await resetClientPassword(brandId);
  refresh(brand);
  return res;
}

async function chatBrand(brandId) {
  const me = await requireMember();
  if (!canSeeBrands(me)) return { error: "Only admin / ops and execution heads can chat with clients." };
  const brand = await getBrand(brandId);
  if (!brand) return { error: "Brand not found." };
  return { me, brand };
}

/** The brand's chat with the client. */
export async function brandChat(brandId) {
  const { brand, error } = await chatBrand(brandId);
  if (error) return { ok: false, error };
  const chat = await loadChat(brand.id);
  return { ok: true, messages: chat.messages, reads: chat.reads };
}

export async function sendBrandMessage(brandId, body, attachments) {
  const { me, brand, error } = await chatBrand(brandId);
  if (error) return { ok: false, error };
  return postMessage({ brand, memberId: me.id, body, attachments, senderName: me.name });
}

export async function brandChatUpload(brandId, fileName, size) {
  const { brand, error } = await chatBrand(brandId);
  if (error) return { ok: false, error };
  return chatUploadUrl(brand.id, fileName, size);
}

export async function markBrandRead(brandId) {
  const { me, brand, error } = await chatBrand(brandId);
  if (error) return { ok: false };
  await markRead(brand.id, me.id);
  revalidatePath("/brands");
  return { ok: true };
}

/**
 * Admin: add a brand Inloop already works with (no lead / MOU flow). Makes a "Won" lead for it, the brand
 * (active straight away, no celebration pop-up) and its monthly deliverables from `month` on.
 * input: { name, contact, phone, email, services: [names], deliverables: { post, carousel, story, reel, video }, month: "2026-11" }
 */
export async function addExistingBrand(input) {
  const me = await requireMember();
  if (me.role !== "admin") return { ok: false, error: "Only an admin can add brands." };
  const name = str(input?.name, 200);
  if (!name) return { ok: false, error: "Write the brand name." };
  const { data: dup } = await db().from("brands").select("id").ilike("name", name).maybeSingle();
  if (dup) return { ok: false, error: `${name} is already in the CRM.` };
  const services = (Array.isArray(input.services) ? input.services : []).map((s) => str(s, 120)).filter(Boolean).slice(0, 12);
  const [first, ...rest] = (str(input.contact, 200) || name).split(/\s+/);
  const now = new Date().toISOString();

  const { data: lead, error: leadErr } = await db()
    .from("leads")
    .insert({
      first_name: first,
      last_name: rest.join(" "),
      phone: str(input.phone, 40),
      email: str(input.email, 200),
      brand: name,
      service: services.join(", "),
      details: "Existing client, added to the CRM directly.",
      source: "existing",
      status: "Won",
    })
    .select("id, code")
    .single();
  if (leadErr) return { ok: false, error: leadErr.message };
  await addEvents(lead.id, me.id, [{ type: "created", data: { source: "existing client" } }]);

  const { data: brand, error } = await db()
    .from("brands")
    .insert({
      lead_id: lead.id,
      name,
      stage: "active",
      services: services.map((s) => ({ name: s, scope: "", fee: "", billing: "Monthly" })),
      onboarded_at: now,
      created_by: me.id,
    })
    .select("id")
    .single();
  if (error) {
    await db().from("leads").delete().eq("id", lead.id);
    return { ok: false, error: error.message };
  }

  const kinds = ["post", "carousel", "story", "reel", "video"];
  const targets = {};
  for (const k of kinds) {
    const n = Math.max(0, Math.min(200, Math.round(Number(input.deliverables?.[k]) || 0)));
    if (n) targets[k] = n;
  }
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(String(input.month || "")) ? input.month : now.slice(0, 7);
  if (Object.keys(targets).length) {
    await db().from("brand_plans").upsert({ brand_id: brand.id, month: `${month}-01`, targets, notes: "", updated_by: me.id, updated_at: now });
  }
  revalidatePath("/brands");
  revalidatePath("/calendar");
  revalidatePath("/");
  return { ok: true, id: brand.id };
}

/** Admin: change a brand's name, services and contact (also kept on its lead). */
export async function updateBrand(brandId, input) {
  const me = await requireMember();
  if (me.role !== "admin") return { ok: false, error: "Only an admin can edit brands." };
  const brand = await getBrand(brandId);
  if (!brand) return { ok: false, error: "Brand not found." };
  const name = str(input?.name, 200);
  if (!name) return { ok: false, error: "Write the brand name." };
  const { data: dup } = await db().from("brands").select("id").ilike("name", name).neq("id", brandId).maybeSingle();
  if (dup) return { ok: false, error: `Another brand is already called ${name}.` };
  const email = str(input.email, 200);
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return { ok: false, error: "The email doesn't look right." };
  // Keep the fee / scope of services that stay
  const old = Object.fromEntries((brand.services || []).map((s) => [s.name, s]));
  const services = [...new Set((Array.isArray(input.services) ? input.services : []).map((s) => str(s, 120)).filter(Boolean))]
    .slice(0, 20)
    .map((s) => old[s] || { name: s, scope: "", fee: "", billing: "Monthly" });
  const now = new Date().toISOString();
  const { error } = await db().from("brands").update({ name, services, updated_at: now }).eq("id", brandId);
  if (error) return { ok: false, error: error.message };
  const [first, ...rest] = str(input.contact, 200).split(/\s+/).filter(Boolean);
  const leadPatch = { brand: name, service: services.map((s) => s.name).join(", "), phone: str(input.phone, 40), email };
  if (first) Object.assign(leadPatch, { first_name: first, last_name: rest.join(" ") });
  await db().from("leads").update(leadPatch).eq("id", brand.lead_id);
  refresh(brand);
  revalidatePath("/calendar");
  return { ok: true };
}

/**
 * Admin: remove a brand for good — its tasks, calendar, chat, library and client login go with it.
 * `confirmName` must match the brand name. Its lead stays (unless it was only made by "Add existing brands").
 */
export async function deleteBrand(brandId, confirmName) {
  const me = await requireMember();
  if (me.role !== "admin") return { ok: false, error: "Only an admin can delete brands." };
  const brand = await getBrand(brandId);
  if (!brand) return { ok: false, error: "Brand not found." };
  if (str(confirmName, 200).toLowerCase() !== brand.name.trim().toLowerCase()) return { ok: false, error: "Type the brand name exactly to delete it." };
  const { data: account } = await db().from("client_accounts").select("auth_user_id").eq("brand_id", brandId).maybeSingle();
  const { data: lead } = await db().from("leads").select("id, source").eq("id", brand.lead_id).maybeSingle();
  const { error } = await db().from("brands").delete().eq("id", brandId);
  if (error) return { ok: false, error: error.message };
  if (account?.auth_user_id) await db().auth.admin.deleteUser(account.auth_user_id).catch(() => {});
  if (lead?.source === "existing") await db().from("leads").delete().eq("id", lead.id);
  else if (lead) await addEvents(lead.id, me.id, [{ type: "brand_deleted", data: { brand: brand.name } }]);
  revalidatePath("/brands");
  revalidatePath("/calendar");
  revalidatePath("/", "layout");
  return { ok: true };
}
