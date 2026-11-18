"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth";
import { db } from "@/lib/supabase/server";
import { LIBRARY_FOLDERS, LIBRARY_MAX_FILE, LOCKED_FOLDERS, canManageLibrary, canSeeLocked } from "@/lib/library";

const BUCKET = "lead-docs";
const isUuid = (v) => /^[0-9a-f-]{36}$/i.test(String(v || ""));
const isFolder = (f) => LIBRARY_FOLDERS.some((x) => x.id === f);
const clean = (v, max) => String(v ?? "").trim().slice(0, max);
const missing = (e) => (/brand_assets/.test(e?.message || "") ? "The library isn't set up yet — run migration 020 in Supabase." : e?.message || "Something went wrong.");

/** Ops / admin change the library; the Documents folder belongs to the people allowed to open it. */
async function allowed(me, folder) {
  return LOCKED_FOLDERS.includes(folder) ? canSeeLocked(me) : canManageLibrary(me);
}
async function guard(brandId, folder) {
  const me = await requireMember();
  if (!(await allowed(me, folder))) return { error: LOCKED_FOLDERS.includes(folder) ? "Only people allowed to open Documents can change it." : "Only ops and admins can change the library." };
  if (!isUuid(brandId)) return { error: "Brand not found." };
  return { me };
}

/** A signed upload slot for one file going into a brand's library. */
export async function libraryUploadUrl(brandId, folder, name, size) {
  if (!isFolder(folder)) return { ok: false, error: "Pick a folder." };
  const { error } = await guard(brandId, folder);
  if (error) return { ok: false, error };
  if (!(size > 0) || size > LIBRARY_MAX_FILE) return { ok: false, error: "Files must be under 50 MB — add a Google Drive link for bigger ones." };
  const safe = clean(name || "file", 120).replace(/[^\w.\-]+/g, "_") || "file";
  const path = `library/${brandId}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${safe}`;
  const { data, error: e } = await db().storage.from(BUCKET).createSignedUploadUrl(path);
  if (e) return { ok: false, error: e.message };
  return { ok: true, path: data.path, token: data.token };
}

/** Saves uploaded files ({ path, name, size, type }) or a link ({ url, name }) into a folder. */
export async function addLibraryItems(brandId, folder, items) {
  if (!isFolder(folder)) return { ok: false, error: "Pick a folder." };
  const { me, error } = await guard(brandId, folder);
  if (error) return { ok: false, error };
  const rows = (Array.isArray(items) ? items : []).slice(0, 50).flatMap((it) => {
    if (typeof it?.path === "string" && it.path.startsWith(`library/${brandId}/`) && !it.path.includes(".."))
      return [{ brand_id: brandId, folder, name: clean(it.name || "file", 200), storage_path: it.path, size: Number(it.size) || 0, type: clean(it.type, 100), uploaded_by: me.id }];
    const url = clean(it?.url, 2000);
    if (/^https?:\/\/\S+$/i.test(url)) return [{ brand_id: brandId, folder, name: clean(it.name, 200) || url.replace(/^https?:\/\//, "").slice(0, 80), url, uploaded_by: me.id }];
    return [];
  });
  if (!rows.length) return { ok: false, error: "Nothing to add." };
  const { error: e } = await db().from("brand_assets").insert(rows);
  if (e) return { ok: false, error: missing(e) };
  revalidatePath(`/library/${brandId}`);
  revalidatePath("/library");
  return { ok: true };
}

export async function moveLibraryItem(id, folder) {
  const me = await requireMember();
  if (!isUuid(id) || !isFolder(folder)) return { ok: false, error: "Invalid request." };
  const { data: cur } = await db().from("brand_assets").select("folder").eq("id", id).maybeSingle();
  if (!cur) return { ok: false, error: "File not found." };
  if (!(await allowed(me, cur.folder)) || !(await allowed(me, folder))) return { ok: false, error: "You can't move this file there." };
  const { data, error } = await db().from("brand_assets").update({ folder }).eq("id", id).select("brand_id").single();
  if (error) return { ok: false, error: missing(error) };
  revalidatePath(`/library/${data.brand_id}`);
  return { ok: true };
}

export async function deleteLibraryItem(id) {
  const me = await requireMember();
  if (!isUuid(id)) return { ok: false, error: "Invalid request." };
  const { data: a } = await db().from("brand_assets").select("brand_id, storage_path, folder").eq("id", id).maybeSingle();
  if (!a) return { ok: false, error: "Already gone." };
  if (!(await allowed(me, a.folder))) return { ok: false, error: "You can't delete this file." };
  await db().from("brand_assets").delete().eq("id", id);
  if (a.storage_path) await db().storage.from(BUCKET).remove([a.storage_path]);
  revalidatePath(`/library/${a.brand_id}`);
  revalidatePath("/library");
  return { ok: true };
}
