"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth";
import { db } from "@/lib/supabase/server";
import { canManageAssets } from "@/lib/permissions";

const KINDS = ["profile", "presentation", "work", "other"];
const MAX = 100 * 1024 * 1024;
const MIGRATION = "Run migration 024 in Supabase first.";

/** A signed upload URL for one file (up to 100 MB). */
export async function assetUploadUrl(name, size) {
  const me = await requireMember();
  if (!canManageAssets(me)) return { ok: false, error: "Only admin and the sales head add brand assets." };
  if (!(size > 0) || size > MAX) return { ok: false, error: "Files must be under 100 MB — add bigger ones as a link." };
  const safe = String(name || "file").replace(/[^\w.\-]+/g, "_").slice(0, 120);
  const { data, error } = await db().storage.from("lead-docs").createSignedUploadUrl(`assets/${Date.now()}-${safe}`);
  if (error) return { ok: false, error: error.message };
  return { ok: true, path: data.path, token: data.token };
}

/** Save an uploaded file or a link. input: { title, kind, note, path?, fileName?, size?, url? } */
export async function addAsset(input) {
  const me = await requireMember();
  if (!canManageAssets(me)) return { ok: false, error: "Only admin and the sales head add brand assets." };
  const title = String(input?.title || "").trim().slice(0, 200);
  if (!title) return { ok: false, error: "Give it a name." };
  const path = String(input.path || "");
  const url = String(input.url || "").trim();
  if (path && !path.startsWith("assets/")) return { ok: false, error: "Upload not recognised." };
  if (!path && !/^https?:\/\/\S+$/.test(url)) return { ok: false, error: "Upload a file or paste a link." };
  const { error } = await db()
    .from("sales_assets")
    .insert({
      title,
      kind: KINDS.includes(input.kind) ? input.kind : "other",
      note: String(input.note || "").trim().slice(0, 500),
      storage_path: path,
      url: path ? "" : url,
      file_name: String(input.fileName || "").slice(0, 200),
      size: Number(input.size) || 0,
      created_by: me.id,
    });
  if (error) return { ok: false, error: /sales_assets/.test(error.message) ? MIGRATION : error.message };
  revalidatePath("/assets");
  return { ok: true };
}

export async function deleteAsset(id) {
  const me = await requireMember();
  if (!canManageAssets(me)) return { ok: false, error: "Only admin and the sales head remove brand assets." };
  const { data } = await db().from("sales_assets").select("storage_path").eq("id", id).maybeSingle();
  if (!data) return { ok: false, error: "Not found." };
  if (data.storage_path) await db().storage.from("lead-docs").remove([data.storage_path]);
  await db().from("sales_assets").delete().eq("id", id);
  revalidatePath("/assets");
  return { ok: true };
}
