import "server-only";
import { db } from "@/lib/supabase/server";

// Brand assets: what the sales team pitches with — company profiles, presentations and past work.
// Files live in the lead-docs bucket under assets/; links (Drive, Behance, a site) are kept as they are.

export const ASSET_KINDS = [
  ["profile", "Company profiles"],
  ["presentation", "Presentations"],
  ["work", "Past work"],
  ["other", "Other"],
];

/** Every asset, newest first, with a signed link for files. { ok, assets, migration } */
export async function listAssets() {
  const { data, error } = await db().from("sales_assets").select("*, author:members(name)").order("created_at", { ascending: false });
  if (error) return { ok: false, assets: [], migration: /sales_assets/.test(error.message) };
  const paths = (data || []).filter((a) => a.storage_path).map((a) => a.storage_path);
  let signed = {};
  if (paths.length) {
    const { data: s } = await db().storage.from("lead-docs").createSignedUrls(paths, 3600);
    signed = Object.fromEntries((s || []).filter((x) => x.signedUrl).map((x) => [x.path, x.signedUrl]));
  }
  return { ok: true, assets: (data || []).map((a) => ({ ...a, href: a.storage_path ? signed[a.storage_path] || "" : a.url })) };
}
