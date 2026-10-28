import "server-only";
import { db } from "@/lib/supabase/server";
import { crmLink, notify } from "@/lib/slack";

/**
 * Posts an update to every group that receives this event (groups.notify), and to Slack when
 * SLACK_WEBHOOK_URL is set. Never throws — an update failing must not break the pipeline.
 *   event: one of UPDATE_EVENTS ids
 *   post:  { lead: { id, code }, title, body?, url? }
 */
export async function announce(event, { lead, title, body = "", url = "" }) {
  try {
    const { data: groups } = await db().from("groups").select("id").contains("notify", [event]);
    if (groups?.length) {
      await db()
        .from("group_posts")
        .insert(groups.map((g) => ({ group_id: g.id, lead_id: lead?.id || null, event, title, body, url })));
    }
  } catch (err) {
    console.error("Group update failed:", err);
  }
  const link = lead ? ` — ${crmLink(`/leads/${lead.id}`, "open in the CRM")}` : "";
  await notify([`*${title}*${link}`, url, body].filter(Boolean).join("\n"));
}
