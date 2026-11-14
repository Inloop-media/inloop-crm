"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/supabase/server";
import { getCurrentClient } from "@/lib/clients";
import { logTask, notifyTask, TASK_FIELDS } from "@/lib/tasks";
import { CLIENT, chatUploadUrl, loadChat, markRead, postMessage } from "@/lib/chat";

/** The brand approves a piece of work, or asks for changes (the note goes to the execution head). */
export async function clientDecide(taskId, decision, feedback = "") {
  const client = await getCurrentClient();
  if (!client) redirect("/login");
  if (!/^[0-9a-f-]{36}$/i.test(String(taskId))) return { ok: false, error: "Not found." };
  const { data: task } = await db().from("tasks").select(TASK_FIELDS).eq("id", taskId).maybeSingle();
  if (!task || task.brand_id !== client.brand.id) return { ok: false, error: "Not found." };
  if (task.status !== "sent_to_client") return { ok: false, error: "This was already answered." };
  const note = String(feedback || "").trim().slice(0, 4000);
  const now = new Date().toISOString();
  let changes;
  if (decision === "approve") changes = { status: "done", done_at: now, feedback: "" };
  else if (decision === "changes") {
    if (note.length < 3) return { ok: false, error: "Tell us what to change." };
    changes = { status: "client_rejected", feedback: note };
  } else return { ok: false, error: "Unknown answer." };

  const { error } = await db().from("tasks").update({ ...changes, updated_at: now }).eq("id", taskId).eq("status", "sent_to_client");
  if (error) return { ok: false, error: error.message };
  await logTask(taskId, null, decision === "approve" ? "client_ok" : "client_changes", { feedback: note || undefined, by: client.brand.name });
  after(() =>
    decision === "approve"
      ? notifyTask([task.assigned_by, task.assignee_id].filter(Boolean), task, `${client.brand.name} approved`)
      : notifyTask([task.assigned_by].filter(Boolean), task, `${client.brand.name} asked for changes`, note.slice(0, 140))
  );
  revalidatePath("/client");
  revalidatePath(`/tasks/${taskId}`);
  revalidatePath(`/brands/${task.brand_id}`);
  return { ok: true };
}

/** The brand's chat with the team. */
export async function clientChat() {
  const client = await getCurrentClient();
  if (!client) return { ok: false, error: "Signed out." };
  const chat = await loadChat(client.brand.id);
  return { ok: true, messages: chat.messages, reads: chat.reads };
}

export async function clientSendMessage(body, attachments) {
  const client = await getCurrentClient();
  if (!client) return { ok: false, error: "Signed out." };
  return postMessage({ brand: client.brand, fromClient: true, body, attachments });
}

export async function clientChatUpload(fileName, size) {
  const client = await getCurrentClient();
  if (!client) return { ok: false, error: "Signed out." };
  return chatUploadUrl(client.brand.id, fileName, size);
}

export async function clientMarkRead() {
  const client = await getCurrentClient();
  if (!client) return { ok: false };
  await markRead(client.brand.id, CLIENT);
  return { ok: true };
}
