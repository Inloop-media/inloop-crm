import "server-only";
import { db } from "@/lib/supabase/server";
import { PLAN_KINDS } from "@/lib/constants";

const IST = "Asia/Kolkata";
/** "2026-11" for the current month in India. */
export const thisMonth = () => new Date().toLocaleDateString("en-CA", { timeZone: IST }).slice(0, 7);
export const validMonth = (m) => (/^\d{4}-(0[1-9]|1[0-2])$/.test(String(m || "")) ? m : thisMonth());
export function shiftMonth(m, by) {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(Date.UTC(y, mo - 1 + by, 1));
  return d.toISOString().slice(0, 7);
}
export const monthStart = (m) => `${m}-01`;
export const monthLabel = (m) => new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${m}-01T00:00:00Z`));

// "*" so the brief fields (migration 016) come along when they exist
const ITEM_FIELDS = "*, task:tasks!calendar_items_task_id_fkey(id, status, due_at, revision, assignee:members!tasks_assignee_id_fkey(id, name))";

/** Calendar items for one brand (or several) in a month. */
export async function loadItems(brandIds, month) {
  const ids = [].concat(brandIds).filter(Boolean);
  if (!ids.length) return [];
  const { data, error } = await db()
    .from("calendar_items")
    .select(ITEM_FIELDS)
    .in("brand_id", ids)
    .gte("publish_on", monthStart(month))
    .lt("publish_on", monthStart(shiftMonth(month, 1)))
    .order("publish_on")
    .order("created_at");
  if (error) return [];
  return data || [];
}

/** Upcoming items for a brand from today (client dashboard). */
export async function upcomingItems(brandId, limit = 30) {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: IST });
  const { data, error } = await db().from("calendar_items").select("id, publish_on, kind, platform, title, caption, status").eq("brand_id", brandId).gte("publish_on", today).order("publish_on").limit(limit);
  return error ? [] : data || [];
}

/**
 * The plan for each brand in a month. A month without its own plan carries the latest earlier one
 * forward (inherited: true), so a retainer only has to be set once.
 */
export async function loadPlans(brandIds, month) {
  const ids = [].concat(brandIds).filter(Boolean);
  if (!ids.length) return {};
  const { data, error } = await db().from("brand_plans").select("brand_id, month, targets, notes, updated_at").in("brand_id", ids).lte("month", monthStart(month)).order("month", { ascending: false });
  if (error) return {};
  const out = {};
  for (const p of data || []) {
    if (out[p.brand_id]) continue;
    out[p.brand_id] = { ...p, targets: p.targets || {}, inherited: p.month.slice(0, 7) !== month };
  }
  return out;
}

/** Per kind: target, planned (on the calendar), assigned (has a task) and done (approved or posted). */
export function planProgress(plan, items) {
  const targets = plan?.targets || {};
  const kinds = [...new Set([...PLAN_KINDS.filter((k) => targets[k] > 0), ...items.map((i) => i.kind)])];
  const rows = kinds.map((k) => {
    const mine = items.filter((i) => i.kind === k);
    return {
      kind: k,
      target: Number(targets[k]) || 0,
      planned: mine.length,
      assigned: mine.filter((i) => i.task_id).length,
      done: mine.filter((i) => i.status === "posted" || i.task?.status === "done").length,
    };
  });
  const sum = (f) => rows.reduce((n, r) => n + r[f], 0);
  return { rows, target: sum("target"), planned: sum("planned"), assigned: sum("assigned"), done: sum("done") };
}

/**
 * Is this brand's content calendar locked? { locked, by, at } — by = who unlocked it.
 * Before migration 023 there is no lock: it reads as unlocked so nothing stops working.
 */
export async function calendarLock(brandId) {
  const { data, error } = await db().from("brands").select("calendar_unlocked_at, unlocker:members!brands_calendar_unlocked_by_fkey(name)").eq("id", brandId).maybeSingle();
  if (error) return { locked: false, by: "", at: null, ready: false };
  return { locked: !data?.calendar_unlocked_at, by: data?.unlocker?.name || "", at: data?.calendar_unlocked_at || null, ready: true };
}
