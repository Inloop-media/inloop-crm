"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth";
import { db } from "@/lib/supabase/server";
import { canKeepNotes } from "@/lib/permissions";

const isUuid = (v) => /^[0-9a-f-]{36}$/i.test(String(v || ""));
const MISSING = "Run migration 032_my_notes.sql in Supabase first.";

async function me() {
  const m = await requireMember();
  return canKeepNotes(m) ? m : null;
}

/** Add a note to my list. */
export async function addNote(text) {
  const m = await me();
  if (!m) return { ok: false, error: "Notes are for admin and the CBOs." };
  const t = String(text ?? "").trim().slice(0, 1000);
  if (!t) return { ok: false, error: "Write the note first." };
  const { data, error } = await db().from("my_notes").insert({ member_id: m.id, text: t }).select("id, text, done, created_at").single();
  if (error) return { ok: false, error: /my_notes/.test(error.message) ? MISSING : error.message };
  revalidatePath("/");
  return { ok: true, note: data };
}

/** Tick / untick, or change the text — only my own notes. */
export async function updateNote(id, patch = {}) {
  const m = await me();
  if (!m || !isUuid(id)) return { ok: false, error: "Not found." };
  const changes = {};
  if ("done" in patch) Object.assign(changes, { done: !!patch.done, done_at: patch.done ? new Date().toISOString() : null });
  if ("text" in patch) {
    const t = String(patch.text ?? "").trim().slice(0, 1000);
    if (!t) return { ok: false, error: "A note can't be empty." };
    changes.text = t;
  }
  const { error } = await db().from("my_notes").update(changes).eq("id", id).eq("member_id", m.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/");
  return { ok: true };
}

/** Delete one note, or (id = "done") every ticked one. */
export async function deleteNote(id) {
  const m = await me();
  if (!m) return { ok: false, error: "Not found." };
  let q = db().from("my_notes").delete().eq("member_id", m.id);
  if (id === "done") q = q.eq("done", true);
  else if (isUuid(id)) q = q.eq("id", id);
  else return { ok: false, error: "Not found." };
  const { error } = await q;
  if (error) return { ok: false, error: error.message };
  revalidatePath("/");
  return { ok: true };
}
