"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth";
import { db } from "@/lib/supabase/server";
import { canUseBots } from "@/lib/permissions";
import { BOT_BUCKET, BOT_PREFIX, MIGRATION } from "@/lib/bots";

const MAX = 50 * 1024 * 1024;
const fail = (error) => ({ ok: false, error: String(error?.message || error).slice(0, 300) });

/** A signed upload link for one PDF (the browser sends it straight to storage). */
export async function botUploadUrl(name, size) {
  const me = await requireMember();
  if (!canUseBots(me)) return fail("Only admin and the tech heads use bots.");
  if (!/\.pdf$/i.test(String(name || ""))) return fail("Upload the PDF.");
  if (!(size > 0) || size > MAX) return fail("The PDF must be under 50 MB.");
  const safe = String(name).replace(/[^\w.\-]+/g, "_").slice(0, 120);
  const { data, error } = await db().storage.from(BOT_BUCKET).createSignedUploadUrl(`${BOT_PREFIX}crl/${Date.now()}-${safe}`);
  if (error) return fail(error);
  return { ok: true, path: data.path, token: data.token };
}

/** Queue a CRL run: { name, identity, content } (paths from botUploadUrl). The Mac worker picks it up. */
export async function startCrl(input) {
  const me = await requireMember();
  if (!canUseBots(me)) return fail("Only admin and the tech heads use bots.");
  const name = String(input?.name || "").trim().slice(0, 80);
  if (!name) return fail("Write the brand name.");
  const ok = (p) => typeof p === "string" && p.startsWith(`${BOT_PREFIX}crl/`);
  if (!ok(input.identity) || !ok(input.content)) return fail("Upload both PDFs first.");
  const { data, error } = await db()
    .from("bot_runs")
    .insert({ bot: "crl", name, identity_path: input.identity, content_path: input.content, created_by: me.id })
    .select("id")
    .single();
  if (error) return fail(/bot_runs/.test(error.message) ? MIGRATION : error);
  revalidatePath("/bots");
  return { ok: true, id: data.id };
}

/** Run a failed (or stuck) CRL again with the same PDFs. */
export async function retryBotRun(id) {
  const me = await requireMember();
  if (!canUseBots(me)) return fail("Only admin and the tech heads use bots.");
  const { error } = await db()
    .from("bot_runs")
    .update({ status: "queued", progress: "", error: null, result_url: null, finished_at: null })
    .eq("id", id)
    .in("status", ["failed", "queued"]);
  if (error) return fail(error);
  revalidatePath("/bots");
  return { ok: true };
}

/** Remove a run from the list (and its two PDFs). The published CRL site stays live. */
export async function deleteBotRun(id) {
  const me = await requireMember();
  if (!canUseBots(me)) return fail("Only admin and the tech heads use bots.");
  const { data: run } = await db().from("bot_runs").select("id, status, identity_path, content_path").eq("id", id).maybeSingle();
  if (!run) return fail("Not found.");
  if (run.status === "running") return fail("It's running right now — wait for it to finish.");
  await db().storage.from(BOT_BUCKET).remove([run.identity_path, run.content_path]).catch(() => {});
  await db().from("bot_runs").delete().eq("id", run.id);
  revalidatePath("/bots");
  return { ok: true };
}
