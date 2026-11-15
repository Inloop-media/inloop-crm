"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth";
import { db } from "@/lib/supabase/server";
import { getBrand } from "@/lib/brands";
import { createTask } from "@/app/(crm)/tasks/actions";
import { PLAN_KINDS, PLATFORMS, TASK_KINDS } from "@/lib/constants";
import { canEditCalendar, canSetPlan, canAssignTasks } from "@/lib/permissions";

const str = (v, max = 4000) => String(v ?? "").trim().slice(0, max);
const isUuid = (v) => /^[0-9a-f-]{36}$/i.test(String(v || ""));
const isDay = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || "")) && !Number.isNaN(Date.parse(v));

function refresh(brandId) {
  revalidatePath("/calendar");
  revalidatePath(`/brands/${brandId}`);
  revalidatePath("/client");
}

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
    kind: TASK_KINDS.some((k) => k.id === input.kind) ? input.kind : "post",
    platform: PLATFORMS.some((p) => p.id === input.platform) ? input.platform : "instagram",
    updated_at: new Date().toISOString(),
  };
  if (!row.title) return { ok: false, error: "Give it a title or topic." };
  if (!isDay(input.publish_on)) return { ok: false, error: "Pick the date it goes out." };
  row.publish_on = input.publish_on;

  if (input.id) {
    const item = await loadItem(input.id);
    if (!item) return { ok: false, error: "Not found." };
    const { error } = await db().from("calendar_items").update(row).eq("id", item.id);
    if (error) return { ok: false, error: error.message };
    // Keep a linked task's title in step
    if (item.task_id && row.title !== item.title) await db().from("tasks").update({ title: row.title.slice(0, 160) }).eq("id", item.task_id);
    refresh(item.brand_id);
    return { ok: true, id: item.id };
  }
  const brand = await getBrand(input.brand_id);
  if (!brand) return { ok: false, error: "Pick a brand." };
  const { data, error } = await db()
    .from("calendar_items")
    .insert({ ...row, brand_id: brand.id, created_by: me.id })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
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
  const { error } = await db().from("calendar_items").update({ publish_on: day, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh(item.brand_id);
  return { ok: true };
}

export async function setCalendarPosted(id, posted) {
  const me = await requireMember();
  if (!canEditCalendar(me)) return { ok: false, error: "You can't edit the calendar." };
  const item = await loadItem(id);
  if (!item) return { ok: false, error: "Not found." };
  await db().from("calendar_items").update({ status: posted ? "posted" : "planned", updated_at: new Date().toISOString() }).eq("id", id);
  refresh(item.brand_id);
  return { ok: true };
}

export async function deleteCalendarItem(id) {
  const me = await requireMember();
  if (!canEditCalendar(me)) return { ok: false, error: "You can't edit the calendar." };
  const item = await loadItem(id);
  if (!item) return { ok: false, error: "Not found." };
  await db().from("calendar_items").delete().eq("id", id);
  refresh(item.brand_id);
  return { ok: true };
}

/** Head: turn a calendar item into a task for someone (the task's brief is the caption + notes). */
export async function assignCalendarItem(id, { assignee_id, due_at, brief }) {
  const me = await requireMember();
  if (!canAssignTasks(me)) return { ok: false, error: "Only execution heads and admins assign tasks." };
  const item = await loadItem(id);
  if (!item) return { ok: false, error: "Not found." };
  if (item.task_id) return { ok: false, error: "This one already has a task." };
  const text = str(brief, 8000) || [item.caption && `Caption:\n${item.caption}`, item.notes && `Notes:\n${item.notes}`, `Goes out: ${item.publish_on}`].filter(Boolean).join("\n\n");
  const res = await createTask(item.brand_id, { title: item.title, kind: item.kind, assignee_id, due_at, brief: text });
  if (!res.ok) return res;
  await db().from("calendar_items").update({ task_id: res.id, updated_at: new Date().toISOString() }).eq("id", id);
  refresh(item.brand_id);
  return { ok: true, taskId: res.id };
}

/** Head: what the brand gets this month. */
export async function savePlan(brandId, month, targets, notes = "") {
  const me = await requireMember();
  if (!canSetPlan(me)) return { ok: false, error: "Only admin and execution heads set the plan." };
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
