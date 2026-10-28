import "server-only";
import { after } from "next/server";
import { db } from "@/lib/supabase/server";
import { addEvents } from "@/lib/leads";
import { announce } from "@/lib/updates";
import { fullName } from "@/lib/format";

// The proposal pipeline, shared by the server actions (people) and /api/worker/* (the Mac bots):
//   proposal meeting booked → brief shared → strategist picks it up → uploads the 4 documents → submits
//   → CRL bot (Mac) → admin enters commercials → proposal bot (Mac) builds strategy doc + deck → done

export const BUCKET = "lead-docs";
const brandOf = (lead) => lead.brand || fullName(lead);

/** Opens the proposal for a lead (once) and tells the strategists a new brief is waiting. */
export async function shareBriefWithStrategists(lead, actor) {
  const { data: existing } = await db().from("proposals").select("id").eq("lead_id", lead.id).maybeSingle();
  if (existing) return;
  const { error } = await db().from("proposals").insert({ lead_id: lead.id });
  if (error) return; // a second booking at the same moment already opened it
  await addEvents(lead.id, actor?.id, [{ type: "proposal_shared" }]);
  after(() =>
    announce("brief_shared", {
      lead,
      title: `New brief — ${brandOf(lead)} (${lead.code})`,
      body: [lead.service, lead.brief].filter(Boolean).join("\n\n").slice(0, 1500),
    })
  );
}

/** Queues a job for the Mac worker and moves the proposal to the matching stage. */
export async function queueJob(leadId, type, actorId, extra = {}) {
  const { error } = await db().from("jobs").insert({ lead_id: leadId, type });
  if (error) return error.message;
  await db()
    .from("proposals")
    .update({ ...extra, stage: `${type}_queued`, error: "", updated_at: new Date().toISOString() })
    .eq("lead_id", leadId);
  await addEvents(leadId, actorId, [{ type: `proposal_${type}_queued` }]);
  return null;
}

/** Called when the worker picks a job up. */
export async function markRunning(job) {
  await db()
    .from("proposals")
    .update({ stage: `${job.type}_running`, updated_at: new Date().toISOString() })
    .eq("lead_id", job.lead_id);
}

/** Worker finished a job: save the results on the lead and move the pipeline on. */
export async function completeJob(job, result) {
  const now = new Date().toISOString();
  await db().from("jobs").update({ status: "done", result, finished_at: now, progress: "Done" }).eq("id", job.id);
  const { data: lead } = await db().from("leads").select("id, code, brand, first_name, last_name").eq("id", job.lead_id).single();

  for (const f of result.files || []) {
    await db().from("lead_documents").insert({
      lead_id: job.lead_id,
      kind: "output",
      name: String(f.name || "").slice(0, 200),
      storage_path: String(f.path || ""),
      url: String(f.url || ""),
      size: Number(f.size) || 0,
    });
  }

  if (job.type === "crl") {
    await db()
      .from("proposals")
      .update({ stage: "awaiting_commercials", crl_url: String(result.crl_url || ""), crl_ready_at: now, updated_at: now })
      .eq("lead_id", job.lead_id);
    await addEvents(job.lead_id, null, [{ type: "proposal_crl_ready", data: { url: result.crl_url || "" } }]);
    await announce("crl_ready", {
      lead,
      title: `CRL is live — ${brandOf(lead)} (${lead.code})`,
      url: String(result.crl_url || ""),
      body: "Next: the admin enters the commercials for the strategy doc.",
    });
  } else {
    await db()
      .from("proposals")
      .update({
        stage: "done",
        strategy_doc_url: String(result.strategy_doc_url || ""),
        deck_url: String(result.deck_url || ""),
        done_at: now,
        updated_at: now,
      })
      .eq("lead_id", job.lead_id);
    await addEvents(job.lead_id, null, [{ type: "proposal_done" }]);
    await announce("proposal_ready", {
      lead,
      title: `Proposal ready — ${brandOf(lead)} (${lead.code})`,
      url: String(result.deck_url || result.strategy_doc_url || ""),
      body: [result.strategy_doc_url && `Strategy doc: ${result.strategy_doc_url}`, result.deck_url && `Deck: ${result.deck_url}`].filter(Boolean).join("\n"),
    });
  }
}

/** Worker gave up on a job. People can retry from the CRM. */
export async function failJob(job, message) {
  const now = new Date().toISOString();
  const error = String(message || "Unknown error").slice(0, 2000);
  await db().from("jobs").update({ status: "failed", error, finished_at: now }).eq("id", job.id);
  await db().from("proposals").update({ stage: `${job.type}_failed`, error, updated_at: now }).eq("lead_id", job.lead_id);
  await addEvents(job.lead_id, null, [{ type: `proposal_${job.type}_failed`, data: { text: error.slice(0, 280) } }]);
  const { data: lead } = await db().from("leads").select("id, code, brand, first_name, last_name").eq("id", job.lead_id).single();
  await announce("bot_failed", {
    lead,
    title: `${job.type === "crl" ? "CRL" : "Proposal"} bot failed — ${brandOf(lead)} (${lead.code})`,
    body: error.slice(0, 600),
  });
}
