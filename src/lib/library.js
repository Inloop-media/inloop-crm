import "server-only";
import { db } from "@/lib/supabase/server";
import { headsTeam, isExecHead } from "@/lib/permissions";

// Brand library: client-provided brand material (uploaded by ops / admin) + the brand's approved work.

export const LIBRARY_FOLDERS = [
  { id: "identity", label: "Brand identity", icon: "brand", hint: "Logos, fonts, colours, brand guidelines", presets: ["Logos", "Fonts", "Brand guidelines", "Colours"] },
  { id: "images", label: "Images", icon: "board", hint: "Product shots, photos, references", presets: ["Product shots", "Lifestyle", "References"] },
  { id: "videos", label: "Videos", icon: "video", hint: "Raw footage, past ads, b-roll", presets: ["Raw footage", "Past ads"] },
  { id: "documents", label: "Documents", icon: "brief", hint: "Decks, menus, price lists, briefs", presets: [] },
  { id: "other", label: "Other", icon: "list", hint: "Anything else", presets: [] },
];
const BUCKET = "lead-docs";
export const LIBRARY_MAX_FILE = 50 * 1024 * 1024;
export const canManageLibrary = (me) => me.role === "admin" || me.role === "ops";
/** Deleting from the library (files and folders): only admin, the CBOs and managers who run a group. */
export const canDeleteLibrary = (me) => me.role === "admin" || isExecHead(me) || headsTeam(me);
// Documents are confidential (agreements, pricing…): only people with members.can_see_documents (set on the
// Team page) open them — everyone else, admin and ops included, sees the folder locked.
export const LOCKED_FOLDERS = ["documents"];
export async function canSeeLocked(me) {
  const { data, error } = await db().from("members").select("can_see_documents").eq("id", me.id).maybeSingle();
  return !error && Boolean(data?.can_see_documents);
}

/** Signed links (view + download) for storage paths, valid for an hour. */
async function sign(paths) {
  const list = [...new Set(paths.filter(Boolean))];
  if (!list.length) return {};
  const { data } = await db().storage.from(BUCKET).createSignedUrls(list, 3600);
  return Object.fromEntries((data || []).filter((x) => x.signedUrl).map((x) => [x.path, x.signedUrl]));
}
const withLinks = (f, signed) => {
  const href = f.storage_path ? signed[f.storage_path] || "" : f.url;
  const download = f.storage_path && href ? `${href}${href.includes("?") ? "&" : "?"}download=${encodeURIComponent(f.name || "file")}` : f.url;
  return { ...f, href, download };
};

/** Brands with how many files each folder holds, when it last changed, and up to 3 photos for a cover. */
export async function libraryBrands() {
  const [{ data: brands }, { data: assets }, { data: done }] = await Promise.all([
    db().from("brands").select("id, name, stage").order("name"),
    db().from("brand_assets").select("brand_id, folder, name, storage_path, type, created_at").order("created_at", { ascending: false }),
    db().from("tasks").select("brand_id").eq("status", "done"),
  ]);
  const work = (done || []).reduce((m, r) => ((m[r.brand_id] = (m[r.brand_id] || 0) + 1), m), {});
  const by = {};
  const coverPaths = [];
  const isPic = (a) => a.storage_path && a.folder !== "documents" && (/^image\//.test(a.type) || /\.(jpe?g|png|webp|gif)$/i.test(a.name || a.storage_path));
  for (const a of assets || []) {
    const b = (by[a.brand_id] ||= { files: 0, folders: {}, updated: a.created_at, covers: [] });
    b.files += 1;
    b.folders[a.folder] = (b.folders[a.folder] || 0) + 1;
    if (isPic(a) && b.covers.length < 3) {
      b.covers.push(a.storage_path);
      coverPaths.push(a.storage_path);
    }
  }
  const signed = await sign(coverPaths);
  return (brands || []).map((b) => {
    const x = by[b.id] || { files: 0, folders: {}, updated: null, covers: [] };
    return { ...b, files: x.files, folders: x.folders, updated: x.updated, covers: x.covers.map((p) => signed[p]).filter(Boolean), completed: work[b.id] || 0 };
  });
}

/** One brand's library: { brand, assets: { [folder]: [...] }, completed: [{ task, files }], missing } */
export async function brandLibrary(brandId, me) {
  const open = await canSeeLocked(me);
  const { data: brand } = await db().from("brands").select("id, name, stage").eq("id", brandId).maybeSingle();
  if (!brand) return null;
  const [assetsRes, { data: tasks }, foldersRes] = await Promise.all([
    db().from("brand_assets").select("*, uploader:members(name)").eq("brand_id", brandId).order("created_at", { ascending: false }),
    db().from("tasks").select("id, title, kind, revision, done_at, assignee:members!tasks_assignee_id_fkey(name)").eq("brand_id", brandId).eq("status", "done").order("done_at", { ascending: false }).limit(300),
    db().from("brand_asset_folders").select("folder, name").eq("brand_id", brandId).order("name"),
  ]);
  // Folders inside each section: the ready-made ones, ones someone created, and ones files are already in
  const sub = Object.fromEntries(LIBRARY_FOLDERS.map((f) => [f.id, [...f.presets]]));
  for (const r of foldersRes.error ? [] : foldersRes.data || []) if (sub[r.folder] && !sub[r.folder].includes(r.name)) sub[r.folder].push(r.name);
  const all = assetsRes.error ? [] : assetsRes.data || [];
  // Locked folders: people outside development only learn how many files there are — no names, no links
  const lockedCount = Object.fromEntries(LOCKED_FOLDERS.map((f) => [f, all.filter((a) => a.folder === f).length]));
  const assets = open ? all : all.filter((a) => !LOCKED_FOLDERS.includes(a.folder));
  const ids = (tasks || []).map((t) => t.id);
  const { data: files } = ids.length
    ? await db().from("task_files").select("task_id, revision, role, name, storage_path, url, size, created_at").in("task_id", ids).eq("role", "deliverable")
    : { data: [] };
  const signed = await sign([...assets.map((a) => a.storage_path), ...(files || []).map((f) => f.storage_path)]);
  const byFolder = Object.fromEntries(LIBRARY_FOLDERS.map((f) => [f.id, []]));
  for (const a of assets) {
    (byFolder[a.folder] || byFolder.other).push(withLinks(a, signed));
    if (a.subfolder && sub[a.folder] && !sub[a.folder].includes(a.subfolder)) sub[a.folder].push(a.subfolder);
  }
  // The final version of each approved task: the files of its last revision
  const completed = (tasks || [])
    .map((t) => {
      const all = (files || []).filter((f) => f.task_id === t.id);
      const last = Math.max(-1, ...all.map((f) => f.revision));
      return { task: t, files: all.filter((f) => f.revision === last).map((f) => withLinks(f, signed)) };
    })
    .filter((x) => x.files.length);
  return { brand, assets: byFolder, subfolders: sub, foldersReady: !foldersRes.error, completed, missing: Boolean(assetsRes.error), locked: open ? [] : LOCKED_FOLDERS, lockedCount };
}
