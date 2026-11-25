import "server-only";
// Announcements: admin and the CBOs post; everyone gets a push and a pop-up until they press "Got it".
import { db } from "@/lib/supabase/server";

const BUCKET = "lead-docs";
const FIELDS = "id, title, body, link, file_path, file_name, file_type, created_at, author:members!announcements_author_id_fkey(id, name)";

/** Signed links for the attached files (an hour). */
async function withFiles(rows) {
  const paths = rows.filter((a) => a.file_path).map((a) => a.file_path);
  let signed = {};
  if (paths.length) {
    const { data } = await db().storage.from(BUCKET).createSignedUrls(paths, 3600);
    signed = Object.fromEntries((data || []).filter((x) => x.signedUrl).map((x) => [x.path, x.signedUrl]));
  }
  return rows.map(({ file_path, ...a }) => ({ ...a, file: file_path && signed[file_path] ? { href: signed[file_path], name: a.file_name || "file", type: a.file_type || "" } : null }));
}

/**
 * Announcements this person hasn't pressed "Got it" on — from the last 30 days and not older than their account
 * (someone who joins today doesn't get last month's), oldest first so they read in order. Empty before migration 030.
 */
export async function unseenAnnouncements(me) {
  const since = new Date(Math.max(Date.now() - 30 * 864e5, new Date(me.created_at || 0).getTime() - 864e5)).toISOString();
  const { data, error } = await db().from("announcements").select(FIELDS).gte("created_at", since).order("created_at").limit(20);
  if (error || !data?.length) return [];
  const { data: seen } = await db()
    .from("announcement_reads")
    .select("announcement_id")
    .eq("member_id", me.id)
    .in(
      "announcement_id",
      data.map((a) => a.id),
    );
  const read = new Set((seen || []).map((r) => r.announcement_id));
  return withFiles(data.filter((a) => !read.has(a.id) && a.author?.id !== me.id));
}

/** The latest announcements, with who has seen each (for the page). `missing` until migration 030 is run. */
export async function listAnnouncements(limit = 40) {
  const { data, error } = await db().from("announcements").select(FIELDS).order("created_at", { ascending: false }).limit(limit);
  if (error) return { missing: true, items: [], team: [] };
  const ids = (data || []).map((a) => a.id);
  const [{ data: reads }, { data: team }] = await Promise.all([
    ids.length ? db().from("announcement_reads").select("announcement_id, member_id, read_at").in("announcement_id", ids) : { data: [] },
    db().from("members").select("id, name, created_at").eq("active", true).order("name"),
  ]);
  const items = (await withFiles(data || [])).map((a) => ({ ...a, seenBy: (reads || []).filter((r) => r.announcement_id === a.id).map((r) => r.member_id) }));
  return { missing: false, items, team: team || [] };
}
