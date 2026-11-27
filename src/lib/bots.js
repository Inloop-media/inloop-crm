import "server-only";
import { db } from "@/lib/supabase/server";

// Bots run on their own here, apart from the lead flow (the lead CRL/proposal jobs live in `jobs`).
export const BOT_BUCKET = "lead-docs";
export const BOT_PREFIX = "bots/";
export const MIGRATION = "Run migration 038_bot_runs.sql in Supabase first, to turn on Bots.";

/** Recent runs, newest first: { runs, migration } */
export async function listBotRuns(bot = "crl", limit = 30) {
  const { data, error } = await db()
    .from("bot_runs")
    .select("id, bot, name, status, progress, result_url, error, attempts, created_at, started_at, heartbeat_at, finished_at, by:members!bot_runs_created_by_fkey(name)")
    .eq("bot", bot)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return { runs: [], migration: /bot_runs/.test(error.message) };
  // Waiting 2 minutes with nobody picking it up = the Mac worker isn't on
  const now = new Date().getTime();
  const runs = (data || []).map((r) => ({ ...r, stale: r.status === "queued" && now - new Date(r.created_at).getTime() > 120e3 }));
  return { runs, migration: false };
}
