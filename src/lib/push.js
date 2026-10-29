import "server-only";
import webpush from "web-push";
import { db } from "@/lib/supabase/server";

// Phone / desktop push notifications (Web Push). Each device that turns notifications on is a row in
// push_subscriptions; the CRM installs as an app from the browser ("Add to Home Screen").
//   env: NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, optional VAPID_SUBJECT (mailto: or https: URL)

let ready = null;
function configured() {
  if (ready !== null) return ready;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  ready = Boolean(pub && priv);
  if (ready) webpush.setVapidDetails(process.env.VAPID_SUBJECT || process.env.CRM_URL || "https://inloop-crm.vercel.app", pub, priv);
  return ready;
}

/**
 * Sends one notification to every device of these members. Never throws.
 *   payload: { title, body?, url? (path inside the CRM), tag? (same tag replaces the older one) }
 */
export async function pushTo(memberIds, payload) {
  const ids = [...new Set((memberIds || []).filter(Boolean))];
  if (!ids.length || !configured()) return;
  try {
    const { data: subs } = await db()
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth, member:members!inner(active)")
      .in("member_id", ids)
      .eq("member.active", true);
    const message = JSON.stringify({ title: payload.title, body: payload.body || "", url: payload.url || "/", tag: payload.tag || "" });
    const gone = [];
    await Promise.allSettled(
      (subs || []).map((s) =>
        webpush
          .sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, message, { TTL: 24 * 3600 })
          .catch((err) => {
            // The device turned notifications off or the browser dropped the subscription
            if (err.statusCode === 404 || err.statusCode === 410) gone.push(s.id);
            else console.error("Push failed:", err.statusCode, err.body);
          })
      )
    );
    if (gone.length) await db().from("push_subscriptions").delete().in("id", gone);
  } catch (err) {
    console.error("Push failed:", err);
  }
}

/** Active admins and ops. */
export async function staffIds() {
  const { data } = await db().from("members").select("id").in("role", ["admin", "ops"]).eq("active", true);
  return (data || []).map((m) => m.id);
}

/** Members of groups that match the filter, e.g. groupMemberIds({ kind: "strategy" }). */
export async function groupMemberIds({ kind, notify }) {
  let q = db().from("groups").select("group_members(member_id)");
  if (kind) q = q.eq("kind", kind);
  if (notify) q = q.contains("notify", [notify]);
  const { data } = await q;
  return (data || []).flatMap((g) => (g.group_members || []).map((m) => m.member_id));
}
