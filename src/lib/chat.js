import "server-only";
import { after } from "next/server";
import { db } from "@/lib/supabase/server";
import { groupMemberIds, pushTo, staffIds } from "@/lib/push";

// One WhatsApp-style conversation per brand between the client and the team (admin / ops + execution
// heads). Messages and read marks live in Postgres; live updates go out over Supabase Realtime
// broadcast on the channel `chat-{brandId}`. The broadcast only says "something changed" (never the
// message itself) — each side then loads the chat through its own permission-checked server action.

const BUCKET = "lead-docs";
const MAX_TEXT = 4000;
export const CHAT_MAX_FILE = 50 * 1024 * 1024;
export const CLIENT = "client";

export const chatChannel = (brandId) => `chat-${brandId}`;

/** Ping everyone watching this chat. Never throws. */
export async function broadcast(brandId, event, payload = {}) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ topic: chatChannel(brandId), event, payload }] }),
    });
  } catch {}
}

/** Read marks → { client: iso|null, team: iso|null (furthest any team member read), byReader } */
async function readMarks(brandId) {
  const { data } = await db().from("brand_chat_reads").select("reader, read_at").eq("brand_id", brandId);
  const byReader = Object.fromEntries((data || []).map((r) => [r.reader, r.read_at]));
  const team = (data || []).filter((r) => r.reader !== CLIENT).map((r) => r.read_at).sort().pop() || null;
  return { client: byReader[CLIENT] || null, team, byReader };
}

/** The conversation (oldest first, files signed for an hour) + read marks. */
export async function loadChat(brandId, limit = 400) {
  const [{ data, error }, marks] = await Promise.all([
    db()
      .from("brand_messages")
      .select("id, body, attachments, from_client, created_at, member:members(id, name)")
      .eq("brand_id", brandId)
      .order("created_at", { ascending: false })
      .limit(limit),
    readMarks(brandId),
  ]);
  const messages = error ? [] : (data || []).reverse();
  const paths = messages.flatMap((m) => (m.attachments || []).map((a) => a.path)).filter(Boolean);
  let signed = {};
  if (paths.length) {
    const { data: urls } = await db().storage.from(BUCKET).createSignedUrls(paths, 3600);
    signed = Object.fromEntries((urls || []).filter((x) => x.signedUrl).map((x) => [x.path, x.signedUrl]));
  }
  for (const m of messages) m.attachments = (m.attachments || []).map((a) => ({ ...a, href: signed[a.path] || "" }));
  return { messages, reads: { client: marks.client, team: marks.team }, mine: marks.byReader };
}

/** Upload URL for a file going into this brand's chat. */
export async function chatUploadUrl(brandId, fileName, size) {
  if (!(size > 0) || size > CHAT_MAX_FILE) return { ok: false, error: "Files must be under 50 MB." };
  const safe = String(fileName || "file").trim().slice(0, 120).replace(/[^\w.\-]+/g, "_") || "file";
  const path = `chat/${brandId}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${safe}`;
  const { data, error } = await db().storage.from(BUCKET).createSignedUploadUrl(path);
  if (error) return { ok: false, error: error.message };
  return { ok: true, path: data.path, token: data.token };
}

export async function markRead(brandId, reader) {
  const at = new Date().toISOString();
  await db().from("brand_chat_reads").upsert({ brand_id: brandId, reader, read_at: at });
  await broadcast(brandId, "read", { side: reader === CLIENT ? "client" : "team", at });
}

/** Saves a message, tells the open chats, and pushes to the team (everyone but the sender). */
export async function postMessage({ brand, memberId = null, fromClient = false, body, attachments, senderName }) {
  const text = String(body ?? "").trim().slice(0, MAX_TEXT);
  const files = (Array.isArray(attachments) ? attachments : [])
    .filter((a) => typeof a?.path === "string" && a.path.startsWith(`chat/${brand.id}/`) && !a.path.includes(".."))
    .slice(0, 10)
    .map((a) => ({ path: a.path, name: String(a.name || "file").slice(0, 200), size: Number(a.size) || 0, type: String(a.type || "").slice(0, 100) }));
  if (!text && !files.length) return { ok: false, error: "Write a message first." };
  const { data, error } = await db()
    .from("brand_messages")
    .insert({ brand_id: brand.id, member_id: memberId, from_client: fromClient, body: text, attachments: files })
    .select("id, created_at")
    .single();
  if (error) return { ok: false, error: error.message };
  // Sending means you've read everything before it
  await db().from("brand_chat_reads").upsert({ brand_id: brand.id, reader: fromClient ? CLIENT : memberId, read_at: data.created_at });
  await broadcast(brand.id, "msg", { side: fromClient ? "client" : "team" });
  after(async () => {
    const team = [...(await staffIds()), ...(await groupMemberIds({ kind: "execution" }))].filter((id) => id !== memberId);
    const preview = text || (files.length === 1 ? `📎 ${files[0].name}` : `📎 ${files.length} files`);
    await pushTo(team, {
      title: fromClient ? `${brand.name}` : `${senderName || "Team"} → ${brand.name}`,
      body: preview.slice(0, 140),
      url: `/brands/${brand.id}?tab=chat`,
      tag: `chat-${brand.id}`,
    });
  });
  return { ok: true, id: data.id };
}

/** Unread counts per brand for one reader. Team members count the client's and colleagues' messages. */
export async function unreadCounts(brandIds, reader) {
  if (!brandIds.length) return {};
  const [{ data: reads }, { data: msgs }] = await Promise.all([
    db().from("brand_chat_reads").select("brand_id, read_at").eq("reader", reader).in("brand_id", brandIds),
    db().from("brand_messages").select("brand_id, created_at, from_client, member_id").in("brand_id", brandIds).order("created_at", { ascending: false }).limit(2000),
  ]);
  const seen = Object.fromEntries((reads || []).map((r) => [r.brand_id, r.read_at]));
  const out = {};
  for (const m of msgs || []) {
    const others = reader === CLIENT ? !m.from_client : m.from_client || m.member_id !== reader;
    if (others && (!seen[m.brand_id] || m.created_at > seen[m.brand_id])) out[m.brand_id] = (out[m.brand_id] || 0) + 1;
  }
  return out;
}
