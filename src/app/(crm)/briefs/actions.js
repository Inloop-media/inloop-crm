"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth";
import { db } from "@/lib/supabase/server";
import { addEvents } from "@/lib/leads";
import { BUCKET, queueJob } from "@/lib/proposals";
import { canEnterCommercials, canSeeProposal, canWorkOnProposal, isStrategist } from "@/lib/permissions";
import { DOC_KINDS } from "@/lib/constants";

const MAX_FILE = 50 * 1024 * 1024;
const str = (v, max = 5000) => String(v ?? "").trim().slice(0, max);

async function loadProposal(leadId) {
  if (!/^[0-9a-f-]{36}$/i.test(String(leadId))) return null;
  const { data } = await db().from("proposals").select("*, lead:leads(id, code)").eq("lead_id", leadId).maybeSingle();
  return data;
}

const refresh = (leadId) => {
  revalidatePath("/briefs");
  revalidatePath(`/briefs/${leadId}`);
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/");
};

/** A strategist claims a shared brief. First one wins. */
export async function pickUpBrief(leadId) {
  const me = await requireMember();
  if (!isStrategist(me)) return { ok: false, error: "Only creative strategists can pick up briefs." };
  const { data } = await db()
    .from("proposals")
    .update({ strategist_id: me.id, picked_up_at: new Date().toISOString(), stage: "picked_up", updated_at: new Date().toISOString() })
    .eq("lead_id", leadId)
    .is("strategist_id", null)
    .select("id");
  if (!data?.length) return { ok: false, error: "Someone else already picked this brief up." };
  await addEvents(leadId, me.id, [{ type: "proposal_picked", data: { to: me.name } }]);
  refresh(leadId);
  return { ok: true };
}

/** Stages where the strategist can still change the documents. */
const EDITABLE = ["picked_up", "crl_failed"];

/** Step 1 of a file upload: a one-time URL the browser uploads straight to storage with. */
export async function startUpload(leadId, kind, fileName, size, type) {
  const me = await requireMember();
  const p = await loadProposal(leadId);
  if (!p || !canWorkOnProposal(me, p)) return { ok: false, error: "Pick up this brief first." };
  if (!EDITABLE.includes(p.stage)) return { ok: false, error: "The documents are already with the bots." };
  const def = DOC_KINDS.find((k) => k.id === kind);
  if (!def) return { ok: false, error: "Unknown document type." };
  if (!(size > 0) || size > MAX_FILE) return { ok: false, error: "Files must be under 50 MB — share bigger ones as a link." };
  if (def.pdf && !(/\.pdf$/i.test(fileName) || type === "application/pdf")) return { ok: false, error: `${def.label} must be a PDF (the CRL bot reads it).` };

  const safe = str(fileName, 120).replace(/[^\w.\-]+/g, "_") || "file";
  const path = `${p.lead.code}/${kind}/${Date.now()}-${safe}`;
  const { data, error } = await db().storage.from(BUCKET).createSignedUploadUrl(path);
  if (error) return { ok: false, error: error.message };
  return { ok: true, path: data.path, token: data.token };
}

/** Step 2: record the uploaded file — or a link — against the lead. */
export async function addDocument(leadId, kind, doc) {
  const me = await requireMember();
  const p = await loadProposal(leadId);
  if (!p || !canWorkOnProposal(me, p)) return { ok: false, error: "Pick up this brief first." };
  if (!EDITABLE.includes(p.stage)) return { ok: false, error: "The documents are already with the bots." };
  const def = DOC_KINDS.find((k) => k.id === kind);
  if (!def) return { ok: false, error: "Unknown document type." };

  const row = { lead_id: leadId, kind, uploaded_by: me.id };
  if (doc.path) {
    // Only paths this lead's uploads produce
    if (!String(doc.path).startsWith(`${p.lead.code}/${kind}/`)) return { ok: false, error: "Upload not recognised." };
    Object.assign(row, { storage_path: doc.path, name: str(doc.name, 200), size: Number(doc.size) || 0 });
  } else {
    const url = str(doc.url, 1000);
    if (!/^https?:\/\/\S+$/i.test(url)) return { ok: false, error: "Paste a full link starting with https://" };
    if (def.pdf) return { ok: false, error: `${def.label} must be uploaded as a PDF — the CRL bot reads the file.` };
    Object.assign(row, { url, name: str(doc.name, 200) || url.replace(/^https?:\/\//, "").slice(0, 80) });
  }
  const { error } = await db().from("lead_documents").insert(row);
  if (error) return { ok: false, error: error.message };
  refresh(leadId);
  return { ok: true };
}

export async function removeDocument(docId) {
  const me = await requireMember();
  const { data: d } = await db().from("lead_documents").select("*").eq("id", docId).maybeSingle();
  if (!d || d.kind === "output") return { ok: false, error: "Document not found." };
  const p = await loadProposal(d.lead_id);
  if (!p || !canWorkOnProposal(me, p)) return { ok: false, error: "You can't change this brief." };
  if (!EDITABLE.includes(p.stage)) return { ok: false, error: "The documents are already with the bots." };
  if (d.storage_path) await db().storage.from(BUCKET).remove([d.storage_path]);
  await db().from("lead_documents").delete().eq("id", docId);
  refresh(d.lead_id);
  return { ok: true };
}

/** All 4 documents are in → hand them to the CRL bot on the Mac. */
export async function submitForCrl(leadId) {
  const me = await requireMember();
  const p = await loadProposal(leadId);
  if (!p || !canWorkOnProposal(me, p)) return { ok: false, error: "Pick up this brief first." };
  if (!EDITABLE.includes(p.stage)) return { ok: false, error: "Already submitted." };
  const { data: docs } = await db().from("lead_documents").select("kind").eq("lead_id", leadId);
  const missing = DOC_KINDS.filter((k) => !(docs || []).some((d) => d.kind === k.id)).map((k) => k.label);
  if (missing.length) return { ok: false, error: `Still missing: ${missing.join(", ")}.` };
  const err = await queueJob(leadId, "crl", me.id, { submitted_at: new Date().toISOString() });
  if (err) return { ok: false, error: err };
  refresh(leadId);
  return { ok: true };
}

/** Admin enters the commercials once the CRL is ready → the proposal bot builds the proposal deck. */
export async function saveCommercials(leadId, text) {
  const me = await requireMember();
  if (!canEnterCommercials(me)) return { ok: false, error: "Only admins can enter commercials." };
  const p = await loadProposal(leadId);
  if (!p) return { ok: false, error: "No proposal for this lead yet." };
  if (!["awaiting_commercials", "proposal_failed"].includes(p.stage)) return { ok: false, error: "The CRL isn't ready yet." };
  const commercials = str(text, 10000);
  if (!commercials) return { ok: false, error: "Enter the commercials." };
  const err = await queueJob(leadId, "proposal", me.id, {
    commercials,
    commercials_by: me.id,
    commercials_at: new Date().toISOString(),
  });
  if (err) return { ok: false, error: err };
  refresh(leadId);
  return { ok: true };
}

/** Sends a failed step back to the bots. */
export async function retryStep(leadId) {
  const me = await requireMember();
  const p = await loadProposal(leadId);
  if (!p || !canSeeProposal(me, p)) return { ok: false, error: "Not found." };
  const type = p.stage === "crl_failed" ? "crl" : p.stage === "proposal_failed" ? "proposal" : null;
  if (!type) return { ok: false, error: "Nothing to retry." };
  if (type === "crl" ? !canWorkOnProposal(me, p) : !canEnterCommercials(me)) return { ok: false, error: "You can't retry this step." };
  const err = await queueJob(leadId, type, me.id);
  if (err) return { ok: false, error: err };
  refresh(leadId);
  return { ok: true };
}
