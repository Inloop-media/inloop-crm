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
import { listMessages, postMessage } from "@/lib/chat";

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
export async function brandMessages(brandId) {
  const { brand, error } = await chatBrand(brandId);
  if (error) return { ok: false, error };
  return { ok: true, messages: await listMessages(brand.id) };
}

export async function sendBrandMessage(brandId, body) {
  const { me, brand, error } = await chatBrand(brandId);
  if (error) return { ok: false, error };
  return postMessage({ brand, memberId: me.id, body, senderName: me.name });
}
