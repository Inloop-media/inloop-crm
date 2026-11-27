import { db } from "@/lib/supabase/server";
import { BOT_BUCKET } from "@/lib/bots";
import { unauthorised, workerAuthorised } from "@/lib/worker-auth";

const BOTS = ["crl"];

/**
 * The Mac worker asks for the next standalone bot run (Bots tab — not the lead jobs):
 * POST { worker, bots: ["crl"] } → { run: null } or { run: { id, bot, name, attempts }, files: { identity, content } }
 * with short-lived download links for the two PDFs.
 */
export async function POST(request) {
  if (!workerAuthorised(request)) return unauthorised();
  const body = await request.json().catch(() => ({}));
  const worker = String(body.worker || "worker").slice(0, 60);
  const bots = (Array.isArray(body.bots) ? body.bots : BOTS).filter((b) => BOTS.includes(b));
  if (!bots.length) return Response.json({ ok: true, run: null });

  const { data, error } = await db().rpc("claim_bot_run", { p_worker: worker, p_bots: bots });
  // Before migration 038 there's simply nothing to do
  if (error) return Response.json({ ok: true, run: null, note: error.message });
  const run = Array.isArray(data) ? data[0] : data;
  if (!run) return Response.json({ ok: true, run: null });

  const { data: signed, error: e } = await db().storage.from(BOT_BUCKET).createSignedUrls([run.identity_path, run.content_path], 3600);
  if (e || !signed?.[0]?.signedUrl || !signed?.[1]?.signedUrl) {
    await db().from("bot_runs").update({ status: "failed", error: "The uploaded PDFs couldn't be read — upload them again.", finished_at: new Date().toISOString() }).eq("id", run.id);
    return Response.json({ ok: true, run: null });
  }
  return Response.json({
    ok: true,
    run: { id: run.id, bot: run.bot, name: run.name, attempts: run.attempts },
    files: { identity: signed[0].signedUrl, content: signed[1].signedUrl },
  });
}
