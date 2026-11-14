import "server-only";
import { after } from "next/server";
import { db } from "@/lib/supabase/server";
import { groupMemberIds, pushTo, staffIds } from "@/lib/push";

// One conversation per brand between the client and the team (admin / ops + execution heads).

const MAX = 4000;

export async function listMessages(brandId, limit = 300) {
  const { data, error } = await db()
    .from("brand_messages")
    .select("id, body, from_client, created_at, member:members(id, name)")
    .eq("brand_id", brandId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return error ? [] : (data || []).reverse();
}

/** Saves a message and pings the team (everyone but the sender). */
export async function postMessage({ brand, memberId = null, fromClient = false, body, senderName }) {
  const text = String(body ?? "").trim().slice(0, MAX);
  if (!text) return { ok: false, error: "Write a message first." };
  const { error } = await db().from("brand_messages").insert({ brand_id: brand.id, member_id: memberId, from_client: fromClient, body: text });
  if (error) return { ok: false, error: error.message };
  after(async () => {
    const team = [...(await staffIds()), ...(await groupMemberIds({ kind: "execution" }))].filter((id) => id !== memberId);
    await pushTo(team, {
      title: fromClient ? `${brand.name} sent a message` : `${senderName || "Team"} → ${brand.name}`,
      body: text.slice(0, 140),
      url: `/brands/${brand.id}?tab=chat`,
      tag: `chat-${brand.id}`,
    });
  });
  return { ok: true };
}
