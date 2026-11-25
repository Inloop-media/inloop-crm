import "server-only";
// Posting: once the client approves a content-calendar post, the Social Media team gets a "posting" task
// for it (due on the post's date). Whoever posts it marks it posted — from the task or from the calendar.
import { db } from "@/lib/supabase/server";
import { listGroups } from "@/lib/leads";
import { teamLeadIdsOf } from "@/lib/groups";
import { logTask, notifyTask, TASK_FIELDS } from "@/lib/tasks";
import { platformList, platformLabel } from "@/lib/constants";

const POSTABLE = ["post", "carousel", "story", "reel", "video"];
const IST_DAY = new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });

/** Who posts: the Social Media group's team lead, else its first active member. */
export async function posterFor() {
  const groups = (await listGroups()).filter((g) => g.kind === "social");
  for (const g of groups) {
    const active = g.members.filter((m) => m.active);
    const lead = active.find((m) => teamLeadIdsOf(g).includes(m.id));
    if (lead || active[0]) return lead || active[0];
  }
  return null;
}

/** The calendar post a design / video task was made for (if any). */
async function itemOfTask(taskId) {
  const { data } = await db().from("calendar_items").select("*").eq("task_id", taskId).maybeSingle();
  return data || null;
}

/**
 * A calendar post's task was just approved for good (client approved, or approved with no client step):
 * give the Social Media team a posting task for it. Quietly does nothing for non-calendar work, posts that
 * are already posted or already queued, or before migration 029.
 */
export async function queuePosting(task, actor) {
  const item = await itemOfTask(task.id);
  if (!item || !POSTABLE.includes(item.kind) || item.status === "posted") return null;
  const { data: existing, error: e1 } = await db().from("tasks").select("id").eq("post_item_id", item.id).limit(1);
  if (e1 || existing?.length) return null;
  const poster = await posterFor();
  if (!poster) return null;
  const platforms = platformList(item.platform).map(platformLabel).join(", ") || "Instagram";
  const day = IST_DAY.format(new Date(`${item.publish_on}T00:00:00Z`));
  const brief = [
    `Post on ${platforms} — ${day}.`,
    item.caption ? `Caption:\n${item.caption}` : item.caption_direction ? `Caption direction:\n${item.caption_direction}` : "",
    item.cta_objective ? `CTA: ${item.cta_objective}` : "",
    "The final files are on this task — download them, post, then press “Mark as posted”.",
  ]
    .filter(Boolean)
    .join("\n\n");
  const row = {
    brand_id: item.brand_id,
    title: `Post: ${item.title || "content"}`.slice(0, 160),
    kind: "posting",
    brief,
    assignee_id: poster.id,
    assigned_by: actor.id,
    due_at: new Date(`${item.publish_on}T19:00:00+05:30`).toISOString(),
    priority: task.priority || "medium",
    post_item_id: item.id,
  };
  const { data: posting, error } = await db().from("tasks").insert(row).select(TASK_FIELDS).single();
  if (error) return null; // before migration 029
  await logTask(posting.id, actor.id, "created", { to: poster.name });
  if (poster.id !== actor.id) await notifyTask([poster.id], posting, "📣 Ready to post", `${task.brand?.name || "Client"} approved it · post on ${day}`);
  return posting;
}

/**
 * Everything needed to post a calendar post: its details, whether the client approved it, the final
 * files (the approved version of its design / video task, carousel slides in order), and who posted it.
 */
export async function postingKit(itemId) {
  const { data: item } = await db().from("calendar_items").select("*, task:tasks!calendar_items_task_id_fkey(id, status, revision, assignee:members!tasks_assignee_id_fkey(name))").eq("id", itemId).maybeSingle();
  if (!item) return null;
  const work = item.task;
  const approved = item.status === "posted" || work?.status === "done";
  let files = [];
  if (work) {
    const { data } = await db()
      .from("task_files")
      .select("id, name, storage_path, url, size, revision")
      .eq("task_id", work.id)
      .eq("role", "deliverable")
      .eq("revision", work.revision);
    files = (data || []).sort((a, b) => String(a.name).localeCompare(String(b.name), undefined, { numeric: true }));
    const paths = files.filter((f) => f.storage_path).map((f) => f.storage_path);
    let signed = {};
    if (paths.length) {
      const { data: s } = await db().storage.from("lead-docs").createSignedUrls(paths, 3600);
      signed = Object.fromEntries((s || []).filter((x) => x.signedUrl).map((x) => [x.path, x.signedUrl]));
    }
    files = files.map((f) => {
      const href = f.storage_path ? signed[f.storage_path] || "" : f.url;
      return { id: f.id, name: f.name, link: !f.storage_path, href, download: f.storage_path && href ? `${href}${href.includes("?") ? "&" : "?"}download=${encodeURIComponent(f.name || "file")}` : href };
    });
  }
  const [{ data: posting }, poster] = await Promise.all([
    db().from("tasks").select("id, status, assignee:members!tasks_assignee_id_fkey(id, name)").eq("post_item_id", item.id).limit(1),
    item.posted_by ? db().from("members").select("name").eq("id", item.posted_by).maybeSingle() : { data: null },
  ]);
  // Why it was last taken back (shown to the Social Media team until it's posted again)
  let undo = null;
  if (posting?.[0] && item.status !== "posted") {
    const { data: ev } = await db().from("task_events").select("data, created_at, actor:members(name)").eq("task_id", posting[0].id).eq("type", "unposted").order("created_at", { ascending: false }).limit(1);
    if (ev?.[0]) undo = { reason: ev[0].data?.reason || "", by: ev[0].actor?.name || "", at: ev[0].created_at };
  }
  return {
    item: {
      id: item.id,
      brand_id: item.brand_id,
      title: item.title,
      kind: item.kind,
      publish_on: item.publish_on,
      platforms: platformList(item.platform).map(platformLabel),
      caption: item.caption || "",
      caption_direction: item.caption_direction || "",
      cta: item.cta_objective || "",
      status: item.status,
      posted_at: item.posted_at || null,
      post_url: item.post_url || "",
      posted_by: poster?.data?.name || "",
    },
    approved,
    maker: work?.assignee?.name || "",
    files,
    posting: posting?.[0] || null,
    undo,
  };
}
