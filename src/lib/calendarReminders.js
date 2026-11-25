import "server-only";
// Content-calendar reminders, sent in the morning window (10:00–14:00 IST) with the other digests, at most once a
// day per person:
//   • Not assigned — posts go out next week but have no task yet (work is assigned a week before it goes out).
//     Wednesday to Saturday it checks this week's remaining posts + next week's; Monday/Tuesday only this week's.
//     Goes to the CBO who runs the designers / video editors (Krrish).
//   • Calendar not updated — a brand's calendar has fewer posts than its monthly deliverables. Mondays and
//     Thursdays; this month, plus next month from the 20th. Goes to the creative strategists, their CBO (Udit) and Krrish.
import { db } from "@/lib/supabase/server";
import { pushTo } from "@/lib/push";
import { listGroups } from "@/lib/leads";
import { teamLeadIdsOf } from "@/lib/groups";
import { loadItems, loadPlans, planProgress, shiftMonth, thisMonth } from "@/lib/calendar";
import { kindPlural } from "@/lib/constants";

const IST = "Asia/Kolkata";
const DAY = 864e5;
const dayKey = (d) => new Date(d).toLocaleDateString("en-CA", { timeZone: IST });
/** 1 = Monday … 7 = Sunday, in India. */
const weekday = (d) => {
  const w = new Date(`${dayKey(d)}T00:00:00Z`).getUTCDay();
  return w === 0 ? 7 : w;
};
const short = (d) => new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", day: "numeric", month: "short" }).format(new Date(`${d}T00:00:00Z`));
const list = (xs) => (xs.length > 3 ? `${xs.slice(0, 3).join(", ")} +${xs.length - 3} more` : xs.join(", "));

async function claim(kind, memberIds, day) {
  if (!memberIds.length) return [];
  const { data, error } = await db()
    .from("digest_log")
    .upsert(
      memberIds.map((member_id) => ({ member_id, kind, day })),
      { onConflict: "member_id,kind,day", ignoreDuplicates: true },
    )
    .select("member_id");
  if (error) return [];
  return (data || []).map((r) => r.member_id);
}

/** Who gets what: the CBO(s) running the design / video groups, and the creative strategists (+ their lead and CBO). */
async function people() {
  const groups = await listGroups();
  const active = (g) => g.members.filter((m) => m.active).map((m) => m.id);
  const makers = groups.filter((g) => g.kind === "design" || g.kind === "video");
  const assigners = [...new Set(makers.map((g) => g.owner_id).filter(Boolean))];
  const strategy = groups.filter((g) => g.kind === "strategy");
  const strategists = [...new Set(strategy.flatMap((g) => [...active(g), ...teamLeadIdsOf(g), ...(g.owner_id ? [g.owner_id] : [])]))];
  return { assigners, strategists };
}

async function activeBrands() {
  const { data } = await db().from("brands").select("id, name").eq("stage", "active");
  return data || [];
}

/** Posts from today to the end of next week (or this week on Mon/Tue) that nobody has been given yet. */
async function unassigned(now, brands) {
  const wd = weekday(now);
  if (wd === 7) return { posts: [], until: null };
  const sundayThisWeek = now + (7 - wd) * DAY;
  const until = dayKey(wd >= 3 ? sundayThisWeek + 7 * DAY : sundayThisWeek);
  const { data } = await db()
    .from("calendar_items")
    .select("id, brand_id, title, kind, publish_on, status")
    .in("brand_id", brands.map((b) => b.id))
    .is("task_id", null)
    .neq("status", "posted")
    .gte("publish_on", dayKey(now))
    .lte("publish_on", until)
    .order("publish_on");
  return { posts: data || [], until };
}

/** Brands whose calendar is short of the deliverables, this month (and next month from the 20th). */
async function behindPlan(now, brands) {
  const months = [thisMonth()];
  if (Number(dayKey(now).slice(8, 10)) >= 20) months.push(shiftMonth(months[0], 1));
  const out = [];
  for (const month of months) {
    const ids = brands.map((b) => b.id);
    const [plans, items] = await Promise.all([loadPlans(ids, month), loadItems(ids, month)]);
    for (const b of brands) {
      const plan = plans[b.id];
      if (!plan || !Object.values(plan.targets).some((n) => n > 0)) continue;
      const p = planProgress(
        plan,
        items.filter((i) => i.brand_id === b.id),
      );
      const missing = p.rows.filter((r) => r.planned < r.target).map((r) => `${r.target - r.planned} ${kindPlural(r.kind).toLowerCase()}`);
      if (missing.length) out.push({ brand: b, month, missing, planned: p.planned, target: p.target });
    }
  }
  return out;
}

/**
 * Run the calendar reminders. `dry: true` sends nothing and returns what would go out (for checking).
 */
export async function calendarReminders(now = Date.now(), { dry = false } = {}) {
  const brands = await activeBrands();
  if (!brands.length) return { calendar: "no brands" };
  const name = Object.fromEntries(brands.map((b) => [b.id, b.name]));
  const today = dayKey(now);
  const wd = weekday(now);
  const { assigners, strategists } = await people();
  const out = {};

  // 1 — posts coming up with no one on them
  const { posts, until } = await unassigned(now, brands);
  if (posts.length) {
    const byBrand = {};
    for (const p of posts) (byBrand[p.brand_id] ||= []).push(p);
    const parts = Object.entries(byBrand)
      .sort((a, b) => b[1].length - a[1].length)
      .map(([id, ps]) => `${name[id]} ${ps.length}`);
    const soonest = posts[0];
    const msg = {
      title: `📅 ${posts.length} calendar ${posts.length === 1 ? "post" : "posts"} not assigned yet`,
      body: `Going out by ${short(until)} — ${list(parts)}. First one: ${soonest.title} (${name[soonest.brand_id]}, ${short(soonest.publish_on)}).`,
      url: `/calendar?month=${soonest.publish_on.slice(0, 7)}`,
      tag: `cal-unassigned-${today}`,
    };
    const to = dry ? assigners : await claim("cal-unassigned", assigners, today);
    if (!dry) await pushTo(to, msg);
    out.unassigned = { posts: posts.length, to: to.length, ...(dry ? { msg } : {}) };
  }

  // 2 — calendars short of the deliverables (Mondays and Thursdays)
  if (wd === 1 || wd === 4 || dry) {
    const behind = await behindPlan(now, brands);
    if (behind.length) {
      const mon = (m) => new Intl.DateTimeFormat("en-IN", { month: "short", timeZone: "UTC" }).format(new Date(`${m}-01T00:00:00Z`));
      const byBrand = {};
      for (const x of behind) (byBrand[x.brand.name] ||= []).push(`${mon(x.month)} ${x.planned}/${x.target}`);
      const names = Object.keys(byBrand);
      const one = behind.length === 1 ? behind[0] : null;
      const msg = {
        title: one ? `🗓️ ${one.brand.name}: calendar not updated` : names.length === 1 ? `🗓️ ${names[0]}: calendar not updated` : `🗓️ ${names.length} brands: calendar not updated`,
        body: one
          ? `${mon(one.month)}: ${one.planned}/${one.target} planned — add ${list(one.missing)}.`
          : `Short of the deliverables: ${list(names.map((n) => `${n} (${byBrand[n].join(", ")})`))}.`,
        url: one ? `/calendar?brand=${one.brand.id}&month=${one.month}` : `/calendar?month=${behind[0].month}`,
        tag: `cal-behind-${today}`,
      };
      const recipients = [...new Set([...strategists, ...assigners])];
      const to = dry ? recipients : await claim("cal-behind", recipients, today);
      if (!dry) await pushTo(to, msg);
      out.behind = { brands: behind.length, to: to.length, ...(dry ? { msg, detail: behind.map((x) => ({ brand: x.brand.name, month: x.month, missing: x.missing })) } : {}) };
    }
  }
  return { calendar: out };
}
