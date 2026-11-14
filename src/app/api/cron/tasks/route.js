import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/supabase/server";
import { notifyTask, TASK_FIELDS } from "@/lib/tasks";
import { OPEN_TASK } from "@/lib/constants";
import { workerAuthorised } from "@/lib/worker-auth";

const HOUR = 3600 * 1000;

/** Vercel Cron sends `Authorization: Bearer $CRON_SECRET`; the Mac worker sends its worker secret. */
function authorised(request) {
  if (workerAuthorised(request)) return true;
  const expected = process.env.CRON_SECRET || "";
  const given = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  return expected.length >= 16 && given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

const inHours = (ms) => {
  const h = Math.round(ms / HOUR);
  return h <= 1 ? "within the hour" : `in ${h} hours`;
};

/**
 * Due-date reminders. Safe to call as often as you like — each task is reminded once before its due date,
 * and once a day while it's overdue (the employee and whoever assigned it).
 */
export async function GET(request) {
  if (!authorised(request)) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const now = Date.now();
  const iso = (t) => new Date(t).toISOString();

  const [{ data: soon, error }, { data: late }] = await Promise.all([
    db().from("tasks").select(TASK_FIELDS).in("status", OPEN_TASK).is("due_soon_notified_at", null).gt("due_at", iso(now)).lte("due_at", iso(now + 24 * HOUR)),
    db().from("tasks").select(TASK_FIELDS).in("status", OPEN_TASK).lt("due_at", iso(now)).or(`overdue_notified_at.is.null,overdue_notified_at.lt.${iso(now - 20 * HOUR)}`),
  ]);
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  for (const t of soon || []) {
    await notifyTask([t.assignee_id], t, "Due soon", `Due ${inHours(new Date(t.due_at).getTime() - now)}.`);
    await db().from("tasks").update({ due_soon_notified_at: iso(now) }).eq("id", t.id);
  }
  for (const t of late || []) {
    const days = Math.max(1, Math.floor((now - new Date(t.due_at).getTime()) / (24 * HOUR)));
    const late = days === 1 ? "The due date has passed." : `Overdue by ${days} days.`;
    await notifyTask([t.assignee_id], t, "Overdue", late);
    if (t.assigned_by && t.assigned_by !== t.assignee_id) await notifyTask([t.assigned_by], t, `Overdue (${t.assignee?.name || "unassigned"})`, late);
    await db().from("tasks").update({ overdue_notified_at: iso(now) }).eq("id", t.id);
  }
  return Response.json({ ok: true, dueSoon: (soon || []).length, overdue: (late || []).length });
}
