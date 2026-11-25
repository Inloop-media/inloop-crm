import "server-only";
// My notes: a private to-do list for admin and the CBOs. Open ones first (oldest on top), then the last done ones.
import { db } from "@/lib/supabase/server";

/** { missing, open, done } — `missing` until migration 032 is run. */
export async function myNotes(memberId) {
  const [open, done] = await Promise.all([
    db().from("my_notes").select("id, text, done, created_at").eq("member_id", memberId).eq("done", false).order("created_at").limit(200),
    db().from("my_notes").select("id, text, done, done_at").eq("member_id", memberId).eq("done", true).order("done_at", { ascending: false }).limit(20),
  ]);
  if (open.error) return { missing: true, open: [], done: [] };
  return { missing: false, open: open.data || [], done: done.data || [] };
}
