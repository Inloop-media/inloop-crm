import { db } from "@/lib/supabase/server";
import { BUCKET, completeJob, failJob } from "@/lib/proposals";
import { unauthorised, workerAuthorised } from "@/lib/worker-auth";

/**
 * Updates from the Mac worker about one job — POST with { action, ... }:
 *   progress  { message }                          → shown in the CRM, keeps the job alive
 *   upload    { name }                             → { path, token, url } to upload an output file to
 *   complete  { crl_url } | { strategy_doc_url, deck_url, files: [{ path, name, size }] }
 *   fail      { error }
 */
export async function POST(request, { params }) {
  if (!workerAuthorised(request)) return unauthorised();
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const { data: job } = await db().from("jobs").select("*, lead:leads(code)").eq("id", id).maybeSingle();
  if (!job) return Response.json({ ok: false, error: "Job not found" }, { status: 404 });
  if (job.status !== "running") return Response.json({ ok: false, error: `Job is ${job.status}` }, { status: 409 });

  switch (body.action) {
    case "progress":
      await db()
        .from("jobs")
        .update({ progress: String(body.message || "").slice(0, 300), heartbeat_at: new Date().toISOString() })
        .eq("id", id);
      return Response.json({ ok: true });

    case "upload": {
      const safe = String(body.name || "file").replace(/[^\w.\-]+/g, "_").slice(0, 120);
      const path = `${job.lead.code}/output/${Date.now()}-${safe}`;
      const { data, error } = await db().storage.from(BUCKET).createSignedUploadUrl(path);
      if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
      return Response.json({ ok: true, path: data.path, token: data.token, url: data.signedUrl });
    }

    case "complete": {
      const files = (Array.isArray(body.files) ? body.files : []).filter((f) => String(f.path || "").startsWith(`${job.lead.code}/output/`));
      await completeJob(job, {
        crl_url: body.crl_url,
        strategy_doc_url: body.strategy_doc_url,
        deck_url: body.deck_url,
        files,
      });
      return Response.json({ ok: true });
    }

    case "fail":
      await failJob(job, body.error);
      return Response.json({ ok: true });

    default:
      return Response.json({ ok: false, error: "Unknown action" }, { status: 400 });
  }
}
