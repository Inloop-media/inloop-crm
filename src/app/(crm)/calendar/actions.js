"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { driveConnection, postFolders } from "@/lib/drive";
import { pingLive } from "@/lib/live";
import { requireMember } from "@/lib/auth";
import { db } from "@/lib/supabase/server";
import { getBrand } from "@/lib/brands";
import { createTask } from "@/app/(crm)/tasks/actions";
import { PLAN_KINDS, TASK_KINDS, platformValue } from "@/lib/constants";
import { canDeleteCalendar, canEditCalendar, canLockCalendar, canSetPlan, canAssignTasks } from "@/lib/permissions";
import { calendarLock, monthStart, shiftMonth, validMonth } from "@/lib/calendar";

const str = (v, max = 4000) => String(v ?? "").trim().slice(0, max);
const isUuid = (v) => /^[0-9a-f-]{36}$/i.test(String(v || ""));
const isDay = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || "")) && !Number.isNaN(Date.parse(v));

const LOCKED = "This calendar is locked. Ask the creative strategists' team lead to unlock it.";
/** Error message when the brand's calendar is locked, else "". */
async function lockedError(brandId) {
  return (await calendarLock(brandId)).locked ? LOCKED : "";
}

/** Team lead (creative strategists) / admin: lock the calendar when the work is done, unlock to work on it. */
export async function setCalendarLock(brandId, locked) {
  const me = await requireMember();
  if (!canLockCalendar(me)) return { ok: false, error: "Only the creative strategists' team lead can lock or unlock the calendar." };
  if (!isUuid(brandId)) return { ok: false, error: "Brand not found." };
  const { error } = await db()
    .from("brands")
    .update(locked ? { calendar_unlocked_at: null, calendar_unlocked_by: null } : { calendar_unlocked_at: new Date().toISOString(), calendar_unlocked_by: me.id })
    .eq("id", brandId);
  if (error) return { ok: false, error: /calendar_unlocked/.test(error.message) ? "Calendar lock needs migration 023 — run it in Supabase first." : error.message };
  refresh(brandId);
  return { ok: true };
}

function refresh(brandId) {
  pingLive("calendar");
  revalidatePath("/calendar");
  revalidatePath(`/brands/${brandId}`);
  revalidatePath("/client");
}

/** The written brief fields (migration 016), cleaned. */
function briefFields(input) {
  const refs = (Array.isArray(input.refs) ? input.refs : String(input.refs || "").split(/\n+/))
    .map((r) => str(r, 500))
    .filter(Boolean)
    .slice(0, 20);
  return {
    creative_brief: str(input.creative_brief, 4000),
    creative_direction: str(input.creative_direction, 4000),
    caption_direction: str(input.caption_direction, 2000),
    cta_objective: str(input.cta_objective, 500),
    refs,
    // Sheet columns with no field of their own: [{ label, value }] in the sheet's order
    extra: (Array.isArray(input.extra) ? input.extra : [])
      .map((x) => ({ label: str(x?.label, 80), value: str(x?.value, 4000) }))
      .filter((x) => x.label)
      .slice(0, 30),
  };
}
const BRIEF_KEYS = ["creative_brief", "creative_direction", "caption_direction", "cta_objective", "refs", "extra"];
const isMissingColumn = (error) => BRIEF_KEYS.some((k) => String(error?.message || "").includes(k));
/** The row without the migration-016 fields, for databases that don't have them yet. */
const basic = (row) => Object.fromEntries(Object.entries(row).filter(([k]) => !BRIEF_KEYS.includes(k)));
/** Retry without just the column the database is missing: `extra` (034) or the 016 fields. */
const strip = (row, error) => (/extra/.test(String(error?.message || "")) ? Object.fromEntries(Object.entries(row).filter(([k]) => k !== "extra")) : basic(row));
const friendly = (error) =>
  /extra/.test(error.message)
    ? "The sheet's extra columns need migration 034 — ask the admin to run it in Supabase."
    : /creative_brief|creative_direction|caption_direction|cta_objective|refs/.test(error.message)
      ? "The new calendar fields need migration 016 — ask the admin to run it in Supabase."
      : error.message;

async function loadItem(id) {
  if (!isUuid(id)) return null;
  const { data } = await db().from("calendar_items").select("*").eq("id", id).maybeSingle();
  return data;
}

/** Create (no id) or update a calendar item. */
export async function saveCalendarItem(input) {
  const me = await requireMember();
  if (!canEditCalendar(me)) return { ok: false, error: "Only strategists and heads edit the calendar." };
  const row = {
    title: str(input.title, 200),
    caption: str(input.caption, 6000),
    notes: str(input.notes, 4000),
    ...briefFields(input),
    kind: TASK_KINDS.some((k) => k.id === input.kind) ? input.kind : "post",
    platform: platformValue(input.platform),
    updated_at: new Date().toISOString(),
  };
  if (!row.title) return { ok: false, error: "Write the content idea." };
  if (!isDay(input.publish_on)) return { ok: false, error: "Pick the date it goes out." };
  row.publish_on = input.publish_on;

  if (input.id) {
    const item = await loadItem(input.id);
    if (!item) return { ok: false, error: "Not found." };
    const locked = await lockedError(item.brand_id);
    if (locked) return { ok: false, error: locked };
    let { error } = await db().from("calendar_items").update(row).eq("id", item.id);
    if (error && isMissingColumn(error)) ({ error } = await db().from("calendar_items").update(strip(row, error)).eq("id", item.id));
    if (error) return { ok: false, error: friendly(error) };
    // Keep a linked task's title in step
    if (item.task_id && row.title !== item.title) await db().from("tasks").update({ title: row.title.slice(0, 160) }).eq("id", item.task_id);
    refresh(item.brand_id);
    return { ok: true, id: item.id };
  }
  const brand = await getBrand(input.brand_id);
  if (brand) {
    const locked = await lockedError(brand.id);
    if (locked) return { ok: false, error: locked };
  }
  if (!brand) return { ok: false, error: "Pick a brand." };
  const insert = (r) => db().from("calendar_items").insert({ ...r, brand_id: brand.id, created_by: me.id }).select("id").single();
  let { data, error } = await insert(row);
  if (error && isMissingColumn(error)) ({ data, error } = await insert(strip(row, error)));
  if (error) return { ok: false, error: friendly(error) };
  refresh(brand.id);
  return { ok: true, id: data.id };
}

/** Drag to another day. */
export async function moveCalendarItem(id, day) {
  const me = await requireMember();
  if (!canEditCalendar(me)) return { ok: false, error: "You can't edit the calendar." };
  if (!isDay(day)) return { ok: false, error: "Bad date." };
  const item = await loadItem(id);
  if (!item) return { ok: false, error: "Not found." };
  const locked = await lockedError(item.brand_id);
  if (locked) return { ok: false, error: locked };
  const { error } = await db().from("calendar_items").update({ publish_on: day, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh(item.brand_id);
  return { ok: true };
}

// Posting is marked by the Social Media team from the post kit (tasks/actions.js markPosted) — no manual toggle here.

export async function deleteCalendarItem(id) {
  const me = await requireMember();
  if (!canDeleteCalendar(me)) return { ok: false, error: "Only admin and the creative strategists can delete posts." };
  const item = await loadItem(id);
  if (!item) return { ok: false, error: "Not found." };
  const locked = await lockedError(item.brand_id);
  if (locked) return { ok: false, error: locked };
  await db().from("calendar_items").delete().eq("id", id);
  refresh(item.brand_id);
  return { ok: true };
}

/** Admin / creative strategists: delete every post of a brand in one month. Tasks already given stay. */
export async function clearCalendarMonth(brandId, month) {
  const me = await requireMember();
  if (!canDeleteCalendar(me)) return { ok: false, error: "Only admin and the creative strategists can delete posts." };
  const m = validMonth(month);
  if (m !== month) return { ok: false, error: "Pick a month." };
  const locked = await lockedError(brandId);
  if (locked) return { ok: false, error: locked };
  const { error, count } = await db()
    .from("calendar_items")
    .delete({ count: "exact" })
    .eq("brand_id", brandId)
    .gte("publish_on", monthStart(m))
    .lt("publish_on", monthStart(shiftMonth(m, 1)));
  if (error) return { ok: false, error: error.message };
  refresh(brandId);
  return { ok: true, deleted: count || 0 };
}

/** Head: turn a calendar item into a task for someone (the task's brief is the caption + notes). */
export async function assignCalendarItem(id, { assignee_id, due_at, brief, priority }) {
  const me = await requireMember();
  if (!canAssignTasks(me)) return { ok: false, error: "Only execution heads and admins assign tasks." };
  const item = await loadItem(id);
  if (!item) return { ok: false, error: "Not found." };
  if (item.task_id) return { ok: false, error: "This one already has a task." };
  const text =
    str(brief, 8000) ||
    [
      // The sheet's own columns (Content Pillar, Hook…) first, as they were in the sheet
      ...(Array.isArray(item.extra) ? item.extra : []).filter((x) => x?.value).map((x) => `${x.label}: ${x.value}`),
      item.creative_brief && `Creative brief:\n${item.creative_brief}`,
      item.creative_direction && `Creative direction:\n${item.creative_direction}`,
      item.caption_direction && `Caption direction:\n${item.caption_direction}`,
      item.caption && `Content copy:\n${item.caption}`,
      item.cta_objective && `CTA objective: ${item.cta_objective}`,
      (item.refs || []).length && `References:\n${item.refs.join("\n")}`,
      item.notes && `Notes:\n${item.notes}`,
      `Goes out: ${item.publish_on}`,
    ]
      .filter(Boolean)
      .join("\n\n");
  const res = await createTask(item.brand_id, { title: item.title, kind: item.kind, assignee_id, due_at, brief: text, priority });
  if (!res.ok) return res;
  await db().from("calendar_items").update({ task_id: res.id, updated_at: new Date().toISOString() }).eq("id", id);
  // Its own Drive folder (…/Reels/Reel 3 – Meet Rose, with Raw + Edited), made right after — never holds the task up
  after(async () => {
    try {
      if (!(await driveConnection())?.root_id) return;
      const brand = await getBrand(item.brand_id);
      const folders = await postFolders(brand, item, me.id);
      await db().from("task_folders").insert(folders.map((f, i) => ({ task_id: res.id, drive_id: f.drive_id, path: f.path, note: f.note, sort: i })));
      pingLive("tasks");
    } catch (err) {
      console.error("Drive folders for the post failed:", err.message);
    }
  });
  refresh(item.brand_id);
  return { ok: true, taskId: res.id };
}

/** Head: what the brand gets this month. */
export async function savePlan(brandId, month, targets, notes = "") {
  const me = await requireMember();
  if (!canSetPlan(me)) return { ok: false, error: "Only an admin can change the deliverables." };
  const brand = await getBrand(brandId);
  if (!brand) return { ok: false, error: "Brand not found." };
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(month))) return { ok: false, error: "Bad month." };
  const clean = {};
  for (const k of PLAN_KINDS) {
    const n = Math.max(0, Math.min(200, Math.round(Number(targets?.[k]) || 0)));
    if (n) clean[k] = n;
  }
  const { error } = await db()
    .from("brand_plans")
    .upsert({ brand_id: brand.id, month: `${month}-01`, targets: clean, notes: str(notes, 2000), updated_by: me.id, updated_at: new Date().toISOString() });
  if (error) return { ok: false, error: error.message };
  refresh(brand.id);
  return { ok: true };
}

/* ------------------------------ Sheet import ------------------------------ */

/**
 * Read a Google Sheet the team shared by link ("Anyone with the link can view"), as CSV text.
 * Only docs.google.com spreadsheet links are fetched.
 */
export async function fetchSheetCsv(link) {
  const me = await requireMember();
  if (!canEditCalendar(me)) return { ok: false, error: "Only strategists and heads edit the calendar." };
  let url;
  try {
    url = new URL(String(link || "").trim());
  } catch {
    return { ok: false, error: "Paste the Google Sheet link." };
  }
  const id = url.hostname === "docs.google.com" && url.pathname.match(/^\/spreadsheets\/d\/([\w-]{20,})/)?.[1];
  if (!id) return { ok: false, error: "That isn't a Google Sheets link (it should start with docs.google.com/spreadsheets)." };
  const gid = url.searchParams.get("gid") || url.hash.match(/gid=(\d+)/)?.[1] || "0";
  const res = await fetch(`https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`, { redirect: "follow", cache: "no-store" }).catch(() => null);
  const type = res?.headers.get("content-type") || "";
  if (!res || !res.ok || !/text\/csv|text\/plain|application\/octet-stream/.test(type)) {
    return { ok: false, error: "Couldn't open the sheet. In Google Sheets click Share → General access → \"Anyone with the link\" (Viewer), then try again — or download it as .xlsx / .csv and upload the file." };
  }
  const text = await res.text();
  if (text.length > 3_000_000) return { ok: false, error: "That sheet is too big — upload one month at a time." };
  return { ok: true, text };
}

/**
 * Save posts read from a sheet into one brand's calendar.
 * replace: first remove this month's posts that aren't assigned or posted yet (so re-importing an updated sheet doesn't duplicate).
 */
export async function importCalendarItems(brandId, month, items, { replace = false } = {}) {
  const me = await requireMember();
  if (!canEditCalendar(me)) return { ok: false, error: "Only strategists and heads edit the calendar." };
  const brand = await getBrand(brandId);
  if (!brand) return { ok: false, error: "Brand not found." };
  const locked = await lockedError(brand.id);
  if (locked) return { ok: false, error: locked };
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(month))) return { ok: false, error: "Bad month." };
  const rows = (Array.isArray(items) ? items : [])
    .slice(0, 400)
    .map((input) => ({
      brand_id: brand.id,
      created_by: me.id,
      publish_on: input.publish_on,
      title: str(input.title, 200),
      caption: str(input.caption, 6000),
      notes: str(input.notes, 4000),
      kind: TASK_KINDS.some((k) => k.id === input.kind) ? input.kind : "post",
      platform: platformValue(input.platform),
      ...briefFields(input),
    }))
    .filter((r) => r.title && isDay(r.publish_on));
  if (!rows.length) return { ok: false, error: "No posts to import." };

  if (replace) {
    const next = (() => {
      const [y, m] = month.split("-").map(Number);
      return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
    })();
    await db().from("calendar_items").delete().eq("brand_id", brand.id).gte("publish_on", `${month}-01`).lt("publish_on", next).is("task_id", null).eq("status", "planned");
  }
  let { error } = await db().from("calendar_items").insert(rows);
  if (error && isMissingColumn(error)) ({ error } = await db().from("calendar_items").insert(rows.map((r) => strip(r, error))));
  if (error) return { ok: false, error: friendly(error) };
  refresh(brand.id);
  return { ok: true, count: rows.length };
}
