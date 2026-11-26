"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth";
import { db } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { LIBRARY_FOLDERS, LIBRARY_MAX_FILE, LOCKED_FOLDERS, canDeleteLibrary, canManageLibrary, canSeeLocked } from "@/lib/library";
import { getBrand } from "@/lib/brands";
import { driveConnection, fileInfo, libraryFolder, moveFile, startUpload, trashFile, uploadBytes } from "@/lib/drive";

const BUCKET = "lead-docs";
const isUuid = (v) => /^[0-9a-f-]{36}$/i.test(String(v || ""));
const isFolder = (f) => LIBRARY_FOLDERS.some((x) => x.id === f);
const clean = (v, max) => String(v ?? "").trim().slice(0, max);
const missing = (e) =>
  /subfolder|brand_asset_folders/.test(e?.message || "")
    ? "Folders need migration 026 — run it in Supabase first."
    : /brand_assets/.test(e?.message || "")
      ? "The library isn't set up yet — run migration 020 in Supabase."
      : e?.message || "Something went wrong.";
// "Logos", "Logos / PNG" — a folder inside a section; "" = not in a folder
const cleanSub = (v) =>
  String(v ?? "")
    .split("/")
    .map((p) => p.trim().replace(/\s+/g, " "))
    .filter(Boolean)
    .join(" / ")
    .slice(0, 120);

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

/** Saves uploaded files ({ path, name, size, type, subfolder }) or a link ({ url, name, subfolder }) into a section. */
export async function addLibraryItems(brandId, folder, items) {
  if (!isFolder(folder)) return { ok: false, error: "Pick a folder." };
  const { me, error } = await guard(brandId, folder);
  if (error) return { ok: false, error };
  const rows = (Array.isArray(items) ? items : []).slice(0, 200).flatMap((it) => {
    const sub = cleanSub(it?.subfolder);
    const extra = sub ? { subfolder: sub } : {};
    if (typeof it?.path === "string" && it.path.startsWith(`library/${brandId}/`) && !it.path.includes(".."))
      return [{ brand_id: brandId, folder, name: clean(it.name || "file", 200), storage_path: it.path, size: Number(it.size) || 0, type: clean(it.type, 100), uploaded_by: me.id, ...extra }];
    const url = clean(it?.url, 2000);
    if (/^https?:\/\/\S+$/i.test(url)) return [{ brand_id: brandId, folder, name: clean(it.name, 200) || url.replace(/^https?:\/\//, "").slice(0, 80), url, uploaded_by: me.id, ...extra }];
    return [];
  });
  if (!rows.length) return { ok: false, error: "Nothing to add." };
  const { error: e } = await db().from("brand_assets").insert(rows);
  if (e) return { ok: false, error: missing(e) };
  revalidatePath(`/library/${brandId}`);
  revalidatePath("/library");
  return { ok: true };
}

/** A new (empty) folder inside a section, e.g. "Packaging" under Images. */
export async function createLibraryFolder(brandId, folder, name) {
  if (!isFolder(folder)) return { ok: false, error: "Pick a section." };
  const { me, error } = await guard(brandId, folder);
  if (error) return { ok: false, error };
  const n = cleanSub(name);
  if (!n) return { ok: false, error: "Give the folder a name." };
  const { error: e } = await db().from("brand_asset_folders").upsert({ brand_id: brandId, folder, name: n, created_by: me.id }, { onConflict: "brand_id,folder,name", ignoreDuplicates: true });
  if (e) return { ok: false, error: missing(e) };
  revalidatePath(`/library/${brandId}`);
  return { ok: true, name: n };
}

/** Removes a folder someone created; its files move out to the section (nothing is deleted). */
export async function deleteLibraryFolder(brandId, folder, name) {
  if (!isFolder(folder) || !isUuid(brandId)) return { ok: false, error: "Pick a section." };
  const me = await requireMember();
  if (!canDeleteLibrary(me)) return { ok: false, error: "Only admin, CBOs and managers can delete from the library." };
  if (LOCKED_FOLDERS.includes(folder) && !(await canSeeLocked(me))) return { ok: false, error: "You can't change this folder." };
  const n = cleanSub(name);
  await db().from("brand_asset_folders").delete().eq("brand_id", brandId).eq("folder", folder).eq("name", n);
  await db().from("brand_assets").update({ subfolder: "" }).eq("brand_id", brandId).eq("folder", folder).eq("subfolder", n);
  revalidatePath(`/library/${brandId}`);
  return { ok: true };
}

/** Move a file to another folder inside its section ("" = out of any folder). */
export async function moveLibraryItemToSub(id, subfolder) {
  const me = await requireMember();
  if (!isUuid(id)) return { ok: false, error: "Invalid request." };
  const { data: cur } = await db().from("brand_assets").select("folder, brand_id").eq("id", id).maybeSingle();
  if (!cur) return { ok: false, error: "File not found." };
  if (!(await allowed(me, cur.folder))) return { ok: false, error: "You can't move this file." };
  const { error } = await db().from("brand_assets").update({ subfolder: cleanSub(subfolder) }).eq("id", id);
  if (error) return { ok: false, error: missing(error) };
  await syncDrive(id);
  revalidatePath(`/library/${cur.brand_id}`);
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
  // A folder belongs to one section — the file comes out of it when it changes section
  await db().from("brand_assets").update({ subfolder: "" }).eq("id", id);
  await syncDrive(id);
  revalidatePath(`/library/${data.brand_id}`);
  return { ok: true };
}

export async function deleteLibraryItem(id) {
  const me = await requireMember();
  if (!isUuid(id)) return { ok: false, error: "Invalid request." };
  const { data: a } = await db().from("brand_assets").select("*").eq("id", id).maybeSingle();
  if (!a) return { ok: false, error: "Already gone." };
  if (!canDeleteLibrary(me)) return { ok: false, error: "Only admin, CBOs and managers can delete from the library." };
  if (LOCKED_FOLDERS.includes(a.folder) && !(await canSeeLocked(me))) return { ok: false, error: "You can't delete this file." };
  await db().from("brand_assets").delete().eq("id", id);
  if (a.storage_path) await db().storage.from(BUCKET).remove([a.storage_path]);
  // On Drive it goes to the Bin (restorable there for 30 days)
  if (a.drive_file_id) await trashFile(a.drive_file_id).catch(() => {});
  revalidatePath(`/library/${a.brand_id}`);
  revalidatePath("/library");
  return { ok: true };
}

/* ------------------------------ On Google Drive ------------------------------ */
// Everything but the confidential Documents section lives on the company Drive:
// "<Brand> / Brand Library / <Section> / <Folder>".

const sectionLabel = (folder) => LIBRARY_FOLDERS.find((f) => f.id === folder)?.label || "Other";
const onDrive = async (folder) => !LOCKED_FOLDERS.includes(folder) && Boolean((await driveConnection())?.root_id);
const fail = (e) => ({ ok: false, error: String(e?.message || e || "Something went wrong.").slice(0, 300) });

/** Where a library item lives on Drive (made if missing). */
async function driveDir(brandId, folder, subfolder, memberId) {
  const brand = await getBrand(brandId);
  if (!brand) throw new Error("Brand not found.");
  return libraryFolder(brand, sectionLabel(folder), cleanSub(subfolder), memberId);
}

/** Start an upload straight from the browser into the brand's Drive library folder. */
export async function startLibraryDriveUpload(brandId, folder, subfolder, file) {
  if (!isFolder(folder)) return { ok: false, error: "Pick a folder." };
  const { me, error } = await guard(brandId, folder);
  if (error) return { ok: false, error };
  if (!(await onDrive(folder))) return { ok: false, error: "This section isn't on Drive." };
  if (!(Number(file?.size) > 0)) return { ok: false, error: "That file is empty." };
  try {
    const dir = await driveDir(brandId, folder, subfolder, me.id);
    const h = await headers();
    const url = await startUpload(dir.drive_id, { name: clean(file.name, 200), size: Number(file.size), type: clean(file.type, 100) }, h.get("origin") || `https://${h.get("host")}`);
    return { ok: true, url, dir: dir.drive_id };
  } catch (e) {
    return fail(e);
  }
}

/** After the browser sent it: check it landed in the folder and add it to the library (link only). */
export async function finishLibraryDriveUpload(brandId, folder, subfolder, dirId, driveFileId) {
  if (!isFolder(folder)) return { ok: false, error: "Pick a folder." };
  const { me, error } = await guard(brandId, folder);
  if (error) return { ok: false, error };
  try {
    const dir = await driveDir(brandId, folder, subfolder, me.id);
    if (dir.drive_id !== dirId) return { ok: false, error: "The folder changed — upload again." };
    const f = await fileInfo(driveFileId);
    if (!(f.parents || []).includes(dir.drive_id)) return { ok: false, error: "The upload didn't land in the library folder." };
    const sub = cleanSub(subfolder);
    const { error: e } = await db()
      .from("brand_assets")
      .insert({ brand_id: brandId, folder, name: clean(f.name, 200), url: f.webViewLink || `https://drive.google.com/file/d/${f.id}/view`, size: Number(f.size) || 0, type: clean(f.mimeType || "", 100), uploaded_by: me.id, drive_file_id: f.id, ...(sub ? { subfolder: sub } : {}) });
    if (e) return { ok: false, error: /drive_file_id/.test(e.message) ? "Run migration 037_library_drive.sql in Supabase first." : missing(e) };
    revalidatePath(`/library/${brandId}`);
    revalidatePath("/library");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Keeps a Drive file in the folder that matches where it is in the library (after a move). */
async function syncDrive(id) {
  const { data: a } = await db().from("brand_assets").select("brand_id, folder, subfolder, drive_file_id").eq("id", id).maybeSingle();
  if (!a?.drive_file_id || LOCKED_FOLDERS.includes(a.folder)) return;
  try {
    const dir = await driveDir(a.brand_id, a.folder, a.subfolder, null);
    await moveFile(a.drive_file_id, dir.drive_id);
  } catch (e) {
    console.error("Drive move failed:", e.message);
  }
}

/** Admin: the library files still in the CRM's own storage that can move to Drive. */
export async function libraryFilesToMove(brandId) {
  const me = await requireMember();
  if (me.role !== "admin" || !isUuid(brandId)) return { ok: false, error: "Only admin moves the library." };
  const { data, error } = await db().from("brand_assets").select("id, name").eq("brand_id", brandId).neq("storage_path", "").is("drive_file_id", null).not("folder", "in", `(${LOCKED_FOLDERS.join(",")})`);
  if (error) return { ok: false, error: /drive_file_id/.test(error.message) ? "Run migration 037_library_drive.sql in Supabase first." : error.message };
  return { ok: true, files: data || [] };
}

/** Admin: copy one stored library file to Drive and point the library at it (the stored copy stays as a backup). */
export async function moveLibraryFileToDrive(id) {
  const me = await requireMember();
  if (me.role !== "admin" || !isUuid(id)) return { ok: false, error: "Only admin moves the library." };
  const { data: a } = await db().from("brand_assets").select("*").eq("id", id).maybeSingle();
  if (!a || !a.storage_path || a.drive_file_id || LOCKED_FOLDERS.includes(a.folder)) return { ok: true, skipped: true };
  try {
    const { data: blob, error } = await db().storage.from(BUCKET).download(a.storage_path);
    if (error || !blob) throw new Error(error?.message || "Couldn't read the stored file.");
    const dir = await driveDir(a.brand_id, a.folder, a.subfolder, me.id);
    const f = await uploadBytes(dir.drive_id, { name: a.name, type: a.type || blob.type }, new Uint8Array(await blob.arrayBuffer()));
    await db().from("brand_assets").update({ drive_file_id: f.id, url: f.webViewLink || `https://drive.google.com/file/d/${f.id}/view` }).eq("id", a.id);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
