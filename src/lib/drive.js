import "server-only";
// Google Drive: the company Drive (tech@) is connected once by admin. The CRM makes every brand's folder
// tree there and work uploaded on a task goes straight from the browser into the task's Drive folders —
// the CRM keeps only the links. It uses the "drive.file" permission, so it sees only folders it made itself.
import { db } from "@/lib/supabase/server";

export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const API = "https://www.googleapis.com/drive/v3";
const ROOT_NAME = "loop – Clients";
export const folderLink = (id) => `https://drive.google.com/drive/folders/${id}`;

export class DriveError extends Error {}

let cached = { token: "", until: 0 };

/** The saved connection: { refresh_token, email, root_id, connected_at } or null (also before migration 035). */
export async function driveConnection() {
  const { data, error } = await db().from("app_settings").select("value").eq("key", "drive").maybeSingle();
  if (error || !data?.value?.refresh_token) return null;
  return data.value;
}
export async function saveConnection(value) {
  cached = { token: "", until: 0 }; // a new connection: don't reuse the old account's token
  const { error } = await db().from("app_settings").upsert({ key: "drive", value, updated_at: new Date().toISOString() });
  if (error) throw new DriveError(/app_settings/.test(error.message) ? "Run migration 035_drive.sql in Supabase first." : error.message);
}

async function token() {
  if (cached.token && cached.until > Date.now() + 60e3) return cached.token;
  const conn = await driveConnection();
  if (!conn) throw new DriveError("Google Drive isn't connected yet — admin connects it on the Brands page.");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, refresh_token: conn.refresh_token, grant_type: "refresh_token" }),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) throw new DriveError(data.error === "invalid_grant" ? "The Drive connection expired — admin connects it again on the Brands page." : `Google Drive sign-in failed (${data.error || res.status}).`);
  cached = { token: data.access_token, until: Date.now() + (data.expires_in || 3000) * 1000 };
  return cached.token;
}

async function api(path, { method = "GET", body, query = {} } = {}) {
  const q = new URLSearchParams({ supportsAllDrives: "true", ...query });
  const res = await fetch(`${API}${path}?${q}`, {
    method,
    headers: { Authorization: `Bearer ${await token()}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new DriveError(`Google Drive: ${data.error?.message || res.status}`);
  return data;
}

async function makeFolder(name, parentId) {
  const f = await api("/files", { method: "POST", query: { fields: "id" }, body: { name, mimeType: "application/vnd.google-apps.folder", ...(parentId ? { parents: [parentId] } : {}) } });
  return f.id;
}

/** The top folder ("loop – Clients"), made the first time, and shared with the team so links open for them. */
export async function ensureRoot(conn, memberEmails = []) {
  if (conn.root_id) return conn.root_id;
  const id = await makeFolder(ROOT_NAME);
  const domain = process.env.ALLOWED_DOMAIN || "inloopmedia.com";
  await api(`/files/${id}/permissions`, { method: "POST", query: { sendNotificationEmail: "false" }, body: { type: "domain", domain, role: "writer" } }).catch(() => {});
  // People with another email domain (e.g. amsglobal.io) are added one by one
  for (const email of memberEmails.filter((e) => !e.toLowerCase().endsWith(`@${domain}`))) {
    await api(`/files/${id}/permissions`, { method: "POST", query: { sendNotificationEmail: "false" }, body: { type: "user", emailAddress: email, role: "writer" } }).catch(() => {});
  }
  return id;
}

/** Same tree for every brand (from the team's sketch). The month / post folders are made as posts are given out. */
export const brandTemplate = (brand, year = new Date().getFullYear()) => [
  ["Ad Creatives"],
  ["Ad Creatives", "Static Ads"],
  ["Ad Creatives", "Carousel Ads"],
  ["Ad Creatives", "Video Ads"],
  ["Branding"],
  ["Branding", "Logos"],
  ["Branding", "Brand Kit"],
  ["Branding", "Stationery Items"],
  ["Website Content"],
  ["Website Content", "SKU RAW IMAGES"],
  ["Website Content", "SKU Catalogue"],
  ["Website Content", "Website Content Copy"],
  ["Website Content", "Website Banners"],
  ["Website Content", "Website Banners", "Static Banners"],
  ["Website Content", "Website Banners", "Video Banners"],
  [`${brand.name} Socials ${year}`],
  [`${brand.name} Socials ${year}`, "Instagram Creatives"],
];

const clean = (s) => String(s || "").replace(/[/\\]+/g, "-").replace(/\s+/g, " ").trim().slice(0, 100);

/**
 * The Drive folder for a path inside a brand (made if missing, parents first). path = [] is the brand folder.
 * Returns { drive_id, path }.
 */
export async function ensurePath(brand, segments, memberId = null) {
  const conn = await driveConnection();
  if (!conn?.root_id) throw new DriveError("Google Drive isn't connected yet — admin connects it on the Brands page.");
  const { data: known } = await db().from("drive_folders").select("drive_id, path").eq("brand_id", brand.id);
  const byPath = new Map((known || []).map((f) => [f.path, f.drive_id]));
  let parent = byPath.get("");
  if (!parent) {
    parent = await makeFolder(clean(brand.name), conn.root_id);
    const { error } = await db().from("drive_folders").insert({ brand_id: brand.id, drive_id: parent, parent_drive_id: conn.root_id, name: clean(brand.name), path: "", created_by: memberId });
    if (error) {
      const { data: other } = await db().from("drive_folders").select("drive_id").eq("brand_id", brand.id).eq("path", "").maybeSingle();
      if (other?.drive_id) parent = other.drive_id;
      else throw new DriveError(/drive_folders/.test(error.message) ? "Run migration 035_drive.sql in Supabase first." : error.message);
    }
    byPath.set("", parent);
  }
  const parts = segments.map(clean).filter(Boolean);
  for (let i = 0; i < parts.length; i++) {
    const path = parts.slice(0, i + 1).join(" / ");
    let id = byPath.get(path);
    if (!id) {
      id = await makeFolder(parts[i], parent);
      const { error } = await db().from("drive_folders").insert({ brand_id: brand.id, drive_id: id, parent_drive_id: parent, name: parts[i], path, created_by: memberId });
      if (error) {
        // Made at the same moment by another request: use theirs
        const { data: other } = await db().from("drive_folders").select("drive_id").eq("brand_id", brand.id).eq("path", path).maybeSingle();
        if (other?.drive_id) id = other.drive_id;
      }
      byPath.set(path, id);
    }
    parent = id;
  }
  return { drive_id: parent, path: parts.join(" / ") };
}

/** Makes the whole standard tree for a brand (missing folders only). */
export async function setupBrand(brand, memberId = null) {
  for (const segs of brandTemplate(brand)) await ensurePath(brand, segs, memberId);
}

/** A brand's folders, sorted by path: [{ drive_id, path }] (the brand folder itself is path ""). */
export async function brandFolders(brandId) {
  const { data, error } = await db().from("drive_folders").select("drive_id, path").eq("brand_id", brandId).order("path");
  return error ? [] : data || [];
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const PLATFORM_NAME = { instagram: "Instagram", facebook: "Facebook", linkedin: "LinkedIn", youtube: "YouTube", x: "X" };
const KIND_FOLDER = { reel: ["Reels", "Reel"], video: ["Videos", "Video"], carousel: ["Carousel", "Carousel"], story: ["Stories", "Story"], post: ["Static Posts", "Static Post"], design: ["Static Posts", "Static Post"] };

/**
 * The folders for a content-calendar post: "<Brand> Socials 2026 / Instagram Creatives / Posting Timeline
 * (01 Dec – 31 Dec) / Reels / Reel 3 – Meet Rose" — reels and videos also get "Reel 3 Raw" and "Reel 3 Edited".
 * Numbered in date order among that month's posts of the same type. Returns [{ drive_id, path, note }].
 */
export async function postFolders(brand, item, memberId = null) {
  const [y, m] = item.publish_on.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const month = `Posting Timeline (01 ${MONTHS[m - 1]} – ${last} ${MONTHS[m - 1]})`;
  const first = String(item.platform || "instagram").split(",")[0];
  const platform = `${PLATFORM_NAME[first] || "Instagram"} Creatives`;
  const [dir, label] = KIND_FOLDER[item.kind] || ["Static Posts", "Static Post"];
  // Its number: this post's place among the month's posts of the same type, in date order
  const from = `${item.publish_on.slice(0, 7)}-01`;
  const to = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  const { data: same } = await db().from("calendar_items").select("id, publish_on, created_at").eq("brand_id", brand.id).eq("kind", item.kind).gte("publish_on", from).lt("publish_on", to).order("publish_on").order("created_at");
  const n = Math.max(1, (same || []).findIndex((x) => x.id === item.id) + 1);
  const idea = clean(item.title).slice(0, 40);
  const base = [`${brand.name} Socials ${y}`, platform, month, dir, `${label} ${n}${idea ? ` – ${idea}` : ""}`];
  const post = await ensurePath(brand, base, memberId);
  if (item.kind === "reel" || item.kind === "video") {
    const raw = await ensurePath(brand, [...base, `${label} ${n} Raw`], memberId);
    const edited = await ensurePath(brand, [...base, `${label} ${n} Edited`], memberId);
    return [
      { ...edited, note: "Final edited file" },
      { ...raw, note: "Raw footage" },
    ];
  }
  return [{ ...post, note: "" }];
}

/**
 * Starts an upload straight from the browser into a Drive folder (resumable, so big videos work).
 * Returns the upload link the browser sends the file to; nothing passes through our server.
 */
export async function startUpload(folderId, { name, size, type }, origin) {
  const q = new URLSearchParams({ uploadType: "resumable", supportsAllDrives: "true", fields: "id,name,size,webViewLink,parents" });
  const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files?${q}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await token()}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": type || "application/octet-stream",
      ...(size ? { "X-Upload-Content-Length": String(size) } : {}),
      // So Google lets the browser at this address send the file
      Origin: origin,
    },
    body: JSON.stringify({ name: clean(name) || "file", parents: [folderId] }),
    cache: "no-store",
  });
  const url = res.headers.get("location");
  if (!res.ok || !url) {
    const data = await res.json().catch(() => ({}));
    throw new DriveError(`Google Drive: ${data.error?.message || res.status}`);
  }
  return url;
}

/** A file's details (to check an upload landed in the right folder). */
export async function fileInfo(id) {
  return api(`/files/${encodeURIComponent(id)}`, { query: { fields: "id,name,size,mimeType,webViewLink,parents" } });
}

/**
 * "Anyone with the link can view" on just this folder / file (and what's inside a folder) — so a client opens
 * the link without asking for access and sees nothing else of the Drive. Returns the link.
 */
export async function shareWithLink(id) {
  try {
    await api(`/files/${encodeURIComponent(id)}/permissions`, { method: "POST", query: { sendNotificationEmail: "false" }, body: { type: "anyone", role: "reader", allowFileDiscovery: false } });
  } catch (err) {
    const m = String(err.message || "");
    if (/publish|outside|domain|policy|not allowed|sharing/i.test(m))
      throw new DriveError("Google Workspace doesn't allow links outside inloopmedia.com yet — the Workspace admin turns on external sharing (admin.google.com → Apps → Google Drive → Sharing settings).");
    throw err;
  }
  const f = await api(`/files/${encodeURIComponent(id)}`, { query: { fields: "id,webViewLink,mimeType" } });
  return f.webViewLink || (f.mimeType === "application/vnd.google-apps.folder" ? folderLink(id) : `https://drive.google.com/file/d/${id}/view`);
}

/* ------------------------------ Brand library ------------------------------ */

/** "<Brand> / Brand Library / Images / Product shots" — made if missing. */
export async function libraryFolder(brand, sectionLabel, subfolder = "", memberId = null) {
  return ensurePath(brand, ["Brand Library", sectionLabel, ...String(subfolder || "").split(" / ").filter(Boolean)], memberId);
}

/** Server-side upload of a file we already have (moving old library files from storage to Drive). */
export async function uploadBytes(folderId, { name, type }, bytes) {
  const boundary = `loop${Math.random().toString(36).slice(2)}`;
  const meta = JSON.stringify({ name: clean(name) || "file", parents: [folderId] });
  const head = Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: ${type || "application/octet-stream"}\r\n\r\n`);
  const tail = Buffer.from(`\r\n--${boundary}--`);
  const q = new URLSearchParams({ uploadType: "multipart", supportsAllDrives: "true", fields: "id,name,size,webViewLink,parents" });
  const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files?${q}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await token()}`, "Content-Type": `multipart/related; boundary=${boundary}` },
    body: Buffer.concat([head, Buffer.from(bytes), tail]),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new DriveError(`Google Drive: ${data.error?.message || res.status}`);
  return data;
}

/** Move a Drive file into another folder (its only folder). */
export async function moveFile(fileId, folderId) {
  const f = await api(`/files/${encodeURIComponent(fileId)}`, { query: { fields: "parents" } });
  return api(`/files/${encodeURIComponent(fileId)}`, { method: "PATCH", query: { addParents: folderId, removeParents: (f.parents || []).join(","), fields: "id,parents" }, body: {} });
}

/** Put a Drive file in the bin (it can still be restored from Drive's Bin for 30 days). */
export async function trashFile(fileId) {
  return api(`/files/${encodeURIComponent(fileId)}`, { method: "PATCH", query: { fields: "id" }, body: { trashed: true } });
}
