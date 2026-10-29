import "server-only";
import { db } from "@/lib/supabase/server";
import { crmLink, notify } from "@/lib/slack";
import { groupMemberIds, pushTo, staffIds } from "@/lib/push";

/**
 * Posts an update to every group that receives this event (groups.notify), pushes it to the phones of
 * the people who need to act, and to Slack when SLACK_WEBHOOK_URL is set. Never throws — an update
 * failing must not break the pipeline.
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
  await pushUpdate(event, { lead, title, body });
  const link = lead ? ` — ${crmLink(`/leads/${lead.id}`, "open in the CRM")}` : "";
  await notify([`*${title}*${link}`, url, body].filter(Boolean).join("\n"));
}

// Who gets a phone notification for each update, beyond the members of the groups that follow it
const ACTION = {
  crl_ready: { staff: "CRL is ready — enter the commercials" },
  bot_failed: { staff: "Open the lead to retry" },
  proposal_ready: { staff: "The proposal deck is ready" },
  brief_shared: { strategists: "Open Briefs to pick it up" },
};

async function pushUpdate(event, { lead, title, body }) {
  try {
    const rule = ACTION[event] || {};
    const staff = rule.staff ? await staffIds() : [];
    const strategists = (rule.strategists ? await groupMemberIds({ kind: "strategy" }) : []).filter((id) => !staff.includes(id));
    const followers = (await groupMemberIds({ notify: event })).filter((id) => !staff.includes(id) && !strategists.includes(id));
    const tag = `${event}-${lead?.id || ""}`;

    await Promise.all([
      pushTo(staff, { title, body: rule.staff, url: lead ? `/leads/${lead.id}#proposal` : "/", tag }),
      pushTo(strategists, { title, body: rule.strategists, url: "/briefs", tag }),
      pushTo(followers, { title, body: (body || "").split("\n")[0].slice(0, 140), url: "/updates", tag }),
    ]);
  } catch (err) {
    console.error("Push update failed:", err);
  }
}
