import { db } from "@/lib/supabase/server";
import { signDocs } from "@/lib/leads";
import { markRunning } from "@/lib/proposals";
import { unauthorised, workerAuthorised } from "@/lib/worker-auth";
import { fullName } from "@/lib/format";

const TYPES = ["crl", "proposal"];

/**
 * The Mac worker asks for the next job: POST { worker: "karans-mac", types: ["crl", "proposal"] }.
 * Answers { job: null } when there's nothing to do, otherwise the job with everything the bot needs:
 * lead summary, brief, commercials, CRL link and short-lived download links for the documents.
 */
export async function POST(request) {
  if (!workerAuthorised(request)) return unauthorised();
  const body = await request.json().catch(() => ({}));
  const worker = String(body.worker || "worker").slice(0, 60);
  const types = (Array.isArray(body.types) ? body.types : TYPES).filter((t) => TYPES.includes(t));
  if (!types.length) return Response.json({ ok: true, job: null });

  const { data, error } = await db().rpc("claim_job", { p_worker: worker, p_types: types });
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  const job = Array.isArray(data) ? data[0] : data;
  if (!job) return Response.json({ ok: true, job: null });
  await markRunning(job);

  const [{ data: lead }, { data: proposal }, { data: docs }] = await Promise.all([
    db().from("leads").select("id, code, first_name, last_name, brand, location, service, budget, details, brief").eq("id", job.lead_id).single(),
    db().from("proposals").select("commercials, crl_url, strategist:members!proposals_strategist_id_fkey(name)").eq("lead_id", job.lead_id).maybeSingle(),
    db().from("lead_documents").select("id, kind, name, storage_path, url").eq("lead_id", job.lead_id).neq("kind", "output").order("created_at"),
  ]);

  return Response.json({
    ok: true,
    job: { id: job.id, type: job.type, attempts: job.attempts },
    lead: { ...lead, client: fullName(lead) },
    proposal: { commercials: proposal?.commercials || "", crl_url: proposal?.crl_url || "", strategist: proposal?.strategist?.name || "" },
    docs: (await signDocs(docs || [])).map((d) => ({ kind: d.kind, name: d.name, url: d.href, is_file: Boolean(d.storage_path) })),
  });
}
