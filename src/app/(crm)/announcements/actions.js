"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth";
import { db } from "@/lib/supabase/server";
import { pushTo } from "@/lib/push";
import { pingLive } from "@/lib/live";
import { canAnnounce } from "@/lib/permissions";

const BUCKET = "lead-docs";
const MAX = 25 * 1024 * 1024;
const str = (v, max) => String(v ?? "").trim().slice(0, max);
const isUuid = (v) => /^[0-9a-f-]{36}$/i.test(String(v || ""));
const MISSING = "Run migration 030_announcements.sql in Supabase first.";

/** Where to upload a photo / PDF for an announcement (signed upload link). */
export async function announcementUploadUrl(name, size) {
  const me = await requireMember();
  if (!canAnnounce(me)) return { ok: false, error: "Only admin and the CBOs post announcements." };
  if (!(size > 0) || size > MAX) return { ok: false, error: "Attach a file under 25 MB — or paste a Google Drive link instead." };
  const safe = str(name || "file", 120).replace(/[^\w.\-]+/g, "_") || "file";
  const path = `announcements/${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${safe}`;
  const { data, error } = await db().storage.from(BUCKET).createSignedUploadUrl(path);
  if (error) return { ok: false, error: error.message };
  return { ok: true, path: data.path, token: data.token };
}

/** Post an announcement: saved, pushed to every active team member's phone, and it pops up in their CRM. */
export async function postAnnouncement(input) {
  const me = await requireMember();
  if (!canAnnounce(me)) return { ok: false, error: "Only admin and the CBOs post announcements." };
  const title = str(input?.title, 140);
  const body = str(input?.body, 5000);
  const link = str(input?.link, 2000);
  if (!title && !body) return { ok: false, error: "Write the announcement first." };
  if (link && !/^https?:\/\/\S+\.\S+$/i.test(link)) return { ok: false, error: "The link should start with https://" };
  const file = input?.file && typeof input.file.path === "string" && input.file.path.startsWith("announcements/") && !input.file.path.includes("..") ? input.file : null;

  const { data: a, error } = await db()
    .from("announcements")
    .insert({ author_id: me.id, title, body, link, file_path: file?.path || null, file_name: str(file?.name, 200), file_type: str(file?.type, 100) })
    .select("id")
    .single();
  if (error) return { ok: false, error: /announcements/.test(error.message) ? MISSING : error.message };

  const { data: team } = await db().from("members").select("id").eq("active", true).neq("id", me.id);
  const first = me.name.split(" ")[0];
  after(() =>
    pushTo(
      (team || []).map((m) => m.id),
      { title: `📣 ${first}: ${title || "Announcement"}`, body: (body || link || (file ? `Shared ${file.name || "a file"}` : "")).slice(0, 180), url: "/announcements", tag: `announce-${a.id}` },
    ),
  );
  pingLive("announcements");
  revalidatePath("/announcements");
  return { ok: true, id: a.id };
}

/** "Got it" — this person has seen it (the pop-up stops showing it). */
export async function markAnnouncementSeen(ids) {
  const me = await requireMember();
  const list = [].concat(ids).filter(isUuid).slice(0, 50);
  if (!list.length) return { ok: true };
  await db()
    .from("announcement_reads")
    .upsert(
      list.map((announcement_id) => ({ announcement_id, member_id: me.id })),
      { onConflict: "announcement_id,member_id", ignoreDuplicates: true },
    );
  revalidatePath("/announcements");
  return { ok: true };
}

/** Take an announcement down (whoever posted it, or admin). */
export async function deleteAnnouncement(id) {
  const me = await requireMember();
  if (!isUuid(id)) return { ok: false, error: "Not found." };
  const { data: a } = await db().from("announcements").select("id, author_id, file_path").eq("id", id).maybeSingle();
  if (!a) return { ok: false, error: "Not found." };
  if (a.author_id !== me.id && me.role !== "admin") return { ok: false, error: "Only the person who posted it (or admin) can delete it." };
  await db().from("announcements").delete().eq("id", id);
  if (a.file_path) await db().storage.from(BUCKET).remove([a.file_path]);
  pingLive("announcements");
  revalidatePath("/announcements");
  return { ok: true };
}
