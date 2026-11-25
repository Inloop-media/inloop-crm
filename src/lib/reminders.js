import "server-only";
// Phone reminders that run on a schedule (the CRM worker calls /api/cron/tasks every 15 minutes, and
// Vercel Cron calls it at 10:00 and 19:00 India time as a backup). Everything here is safe to run as
// often as you like:
//   • evening digest (19:00–23:00 IST) — "Kal tumhare 3 tasks due hain"            once per person per day
//   • morning digest (10:00–14:00 IST) — "Aaj 2 due, 1 late" + heads get their team's late work, once a day
//   • content calendar (lib/calendarReminders.js) — posts not assigned a week ahead, calendars short of deliverables
//   • follow-up reminders on leads   — at the time the salesperson picked, once per reminder
import { db } from "@/lib/supabase/server";
import { pushTo, staffIds } from "@/lib/push";
import { OPEN_TASK } from "@/lib/constants";
import { calendarReminders } from "@/lib/calendarReminders";

const IST = "Asia/Kolkata";
const DAY = 864e5;
const dayKey = (d) => new Date(d).toLocaleDateString("en-CA", { timeZone: IST });
const istHour = (d) => Number(new Intl.DateTimeFormat("en-IN", { timeZone: IST, hour: "numeric", hour12: false }).format(new Date(d)));
const list = (titles) => (titles.length > 3 ? `${titles.slice(0, 3).join(", ")} +${titles.length - 3} more` : titles.join(", "));
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const fullName = (l) => [l.first_name, l.last_name].filter(Boolean).join(" ");

/** Claim today's digest of a kind for these people; returns only the ones not sent yet. Null if the log table is missing. */
async function claim(kind, memberIds, day) {
  if (!memberIds.length) return [];
  const { data, error } = await db()
    .from("digest_log")
    .upsert(
      memberIds.map((member_id) => ({ member_id, kind, day })),
      { onConflict: "member_id,kind,day", ignoreDuplicates: true },
    )
    .select("member_id");
  if (error) return null;
  return (data || []).map((r) => r.member_id);
}

async function openTasks() {
  const { data } = await db().from("tasks").select("id, title, status, due_at, assignee_id, assigned_by, brand:brands(name)").in("status", OPEN_TASK).not("due_at", "is", null).limit(5000);
  return data || [];
}

/** 19:00 IST: tomorrow's tasks, one message per person. */
async function evening(now) {
  const tomorrow = dayKey(now + DAY);
  const due = (await openTasks()).filter((t) => dayKey(t.due_at) === tomorrow);
  const byPerson = {};
  for (const t of due) (byPerson[t.assignee_id] ||= []).push(t);
  const fresh = await claim("evening", Object.keys(byPerson), dayKey(now));
  if (fresh === null) return { evening: "skipped (run migration 014)" };
  for (const id of fresh) {
    const mine = byPerson[id];
    await pushTo([id], {
      title: `Kal tumhare ${plural(mine.length, "task", "tasks")} due ${mine.length === 1 ? "hai" : "hain"}`,
      body: list(mine.map((t) => `${t.title}${t.brand?.name ? ` (${t.brand.name})` : ""}`)),
      url: "/tasks",
      tag: `evening-${dayKey(now)}`,
    });
  }
  return { evening: fresh.length };
}

/** 10:00 IST: what's due today and what's late — to the person, and a team summary to whoever assigned it. */
async function morning(now) {
  const today = dayKey(now);
  const tasks = await openTasks();
  const late = tasks.filter((t) => new Date(t.due_at).getTime() < now);
  const dueToday = tasks.filter((t) => dayKey(t.due_at) === today && new Date(t.due_at).getTime() >= now);

  const mine = {};
  for (const t of [...late, ...dueToday]) (mine[t.assignee_id] ||= { late: [], today: [] })[late.includes(t) ? "late" : "today"].push(t);
  const fresh = await claim("morning", Object.keys(mine), today);
  if (fresh === null) return { morning: "skipped (run migration 014)" };
  for (const id of fresh) {
    const m = mine[id];
    const parts = [m.today.length && `${plural(m.today.length, "task", "tasks")} due aaj`, m.late.length && `${m.late.length} late`].filter(Boolean);
    await pushTo([id], {
      title: m.late.length ? `⚠️ ${parts.join(", ")}` : `Aaj ${plural(m.today.length, "task", "tasks")} due ${m.today.length === 1 ? "hai" : "hain"}`,
      body: list([...m.late.map((t) => `${t.title} (late)`), ...m.today.map((t) => t.title)]),
      url: "/tasks",
      tag: `morning-${today}`,
    });
  }

  // Heads: late work they assigned, in one line
  const byHead = {};
  for (const t of late) if (t.assigned_by && t.assigned_by !== t.assignee_id) (byHead[t.assigned_by] ||= []).push(t);
  const heads = await claim("team-late", Object.keys(byHead), today);
  for (const id of heads || []) {
    const items = byHead[id];
    await pushTo([id], {
      title: `Team: ${plural(items.length, "task", "tasks")} late`,
      body: list(items.map((t) => `${t.title}${t.brand?.name ? ` (${t.brand.name})` : ""}`)),
      url: "/tasks",
      tag: `team-late-${today}`,
    });
  }
  return { morning: fresh.length, teamLate: (heads || []).length };
}

/** Follow-up reminders whose time has come. */
async function followUps(now) {
  const { data, error } = await db()
    .from("leads")
    .select("id, code, brand, first_name, last_name, status, assigned_to, follow_up_at, follow_up_note")
    .lte("follow_up_at", new Date(now).toISOString())
    .is("follow_up_notified_at", null)
    .limit(200);
  if (error) return { followUps: "skipped (run migration 014)" };
  const staff = (data || []).some((l) => !l.assigned_to) ? await staffIds() : [];
  for (const l of data || []) {
    await pushTo(l.assigned_to ? [l.assigned_to] : staff, {
      title: `📞 Follow up: ${l.brand || fullName(l)} (${l.code})`,
      body: l.follow_up_note || `${l.status} — time to call them`,
      url: `/leads/${l.id}`,
      tag: `follow-${l.id}`,
    });
    await db().from("leads").update({ follow_up_notified_at: new Date(now).toISOString() }).eq("id", l.id);
  }
  return { followUps: (data || []).length };
}

/** Run whatever is due right now. */
export async function runReminders(now = Date.now()) {
  const hour = istHour(now);
  const out = { ...(await followUps(now)) };
  // Only inside their windows, so a worker that was off all morning doesn't send "today" at night
  if (hour >= 10 && hour < 14) Object.assign(out, await morning(now), await calendarReminders(now).catch((e) => ({ calendar: String(e?.message || e) })));
  if (hour >= 19 && hour < 23) Object.assign(out, await evening(now));
  return out;
}
