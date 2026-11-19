"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth";
import { canCreateLead, salesTeam } from "@/lib/permissions";
import { addSharedLead, canMessage, loadConversation, markRead, send, uploadUrl } from "@/lib/dm";

const isUuid = (v) => /^[0-9a-f-]{36}$/i.test(String(v || ""));

async function guard(otherId) {
  const me = await requireMember();
  if (!isUuid(otherId) || !(await canMessage(me, otherId))) return { me, error: "You can't message this person." };
  return { me };
}

export async function loadDm(otherId) {
  const { me, error } = await guard(otherId);
  if (error) return { ok: false, error };
  return { ok: true, messages: await loadConversation(me.id, otherId) };
}

export async function sendDm(otherId, body, attachments, lead = null) {
  const { me, error } = await guard(otherId);
  if (error) return { ok: false, error };
  const r = await send(me, otherId, { body, attachments, lead });
  if (r.ok) revalidatePath("/", "layout");
  return r;
}

export async function dmUploadUrl(otherId, name, size) {
  const { me, error } = await guard(otherId);
  if (error) return { ok: false, error };
  return uploadUrl(me.id, otherId, name, size);
}

export async function markDmRead(otherId) {
  const { me, error } = await guard(otherId);
  if (error) return { ok: false, error };
  await markRead(me.id, otherId);
  return { ok: true };
}

/**
 * The sales head (or admin) publishes a lead someone shared with them: optionally corrected (`edits`),
 * given to someone in their team (`assignee`, "" for nobody).
 */
export async function addLeadFromDm(messageId, edits = null, assignee) {
  const me = await requireMember();
  if (!canCreateLead(me)) return { ok: false, error: "Only admins and the sales head can publish leads." };
  if (!isUuid(messageId)) return { ok: false, error: "Invalid request." };
  if (assignee !== undefined && assignee !== "" && !isUuid(assignee)) return { ok: false, error: "Pick who gets the lead." };
  const staff = me.role === "admin" || me.role === "ops";
  if (assignee && !staff && assignee !== me.id && !salesTeam(me).includes(assignee)) return { ok: false, error: "You can only give leads to people in your team." };
  const r = await addSharedLead(me, messageId, edits && typeof edits === "object" ? edits : null, assignee);
  if (r.ok) {
    revalidatePath("/leads");
    revalidatePath("/", "layout");
  }
  return r;
}
