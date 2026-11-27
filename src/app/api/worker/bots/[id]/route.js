import { db } from "@/lib/supabase/server";
import { pushTo } from "@/lib/push";
import { pingLive } from "@/lib/live";
import { unauthorised, workerAuthorised } from "@/lib/worker-auth";

/**
 * Updates from the Mac worker about one standalone bot run — POST { action, ... }:
 *   progress { message } · complete { url } · fail { error }
 */
export async function POST(request, { params }) {
  if (!workerAuthorised(request)) return unauthorised();
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const { data: run } = await db().from("bot_runs").select("id, name, status, created_by").eq("id", id).maybeSingle();
  if (!run) return Response.json({ ok: false, error: "Run not found" }, { status: 404 });
  if (run.status !== "running") return Response.json({ ok: false, error: `Run is ${run.status}` }, { status: 409 });
  const now = new Date().toISOString();

  switch (body.action) {
    case "progress":
      await db().from("bot_runs").update({ progress: String(body.message || "").slice(0, 300), heartbeat_at: now }).eq("id", id);
      pingLive("bots");
      return Response.json({ ok: true });

    case "complete": {
      const url = String(body.url || "").trim();
      if (!/^https?:\/\/\S+$/.test(url)) return Response.json({ ok: false, error: "No link" }, { status: 400 });
      await db().from("bot_runs").update({ status: "done", result_url: url.slice(0, 500), progress: "Done", finished_at: now }).eq("id", id);
      if (run.created_by) await pushTo([run.created_by], { title: `CRL ready · ${run.name}`, body: url, url: "/bots" });
      pingLive("bots");
      return Response.json({ ok: true });
    }

    case "fail":
      await db().from("bot_runs").update({ status: "failed", error: String(body.error || "Failed").slice(0, 500), finished_at: now }).eq("id", id);
      if (run.created_by) await pushTo([run.created_by], { title: `CRL failed · ${run.name}`, body: String(body.error || "").slice(0, 120), url: "/bots" });
      pingLive("bots");
      return Response.json({ ok: true });

    default:
      return Response.json({ ok: false, error: "Unknown action" }, { status: 400 });
  }
}
