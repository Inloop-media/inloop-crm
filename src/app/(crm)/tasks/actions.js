"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { requireMember } from "@/lib/auth";
import { db } from "@/lib/supabase/server";
import { getBrand } from "@/lib/brands";
import { pingLive } from "@/lib/live";
import { canAssignTo, logTask, notifyTask, productionPeople, sharerIds, TASK_FIELDS } from "@/lib/tasks";
import { MAKER_STATUS_OPTIONS, OPEN_TASK, PRIORITIES, RAW_WHAT, TASK_KINDS, TASK_STATUSES, taskKindLabel } from "@/lib/constants";
import { canAssignTasks, canPostContent, canReviewTask, canSeeCalendar, isOpsHead } from "@/lib/permissions";
import { postingKit, queuePosting } from "@/lib/posting";

const str = (v, max = 4000) => String(v ?? "").trim().slice(0, max);
const isUuid = (v) => /^[0-9a-f-]{36}$/i.test(String(v || ""));
const BUCKET = "lead-docs";
const MAX_FILE = 50 * 1024 * 1024;

/** "2026-11-20" or "2026-11-20T18:00" (India time) → ISO; end of day when no time is given. */
function dueAt(v) {
  const s = str(v, 40);
  if (!s) return null;
  const local = /T\d{2}:\d{2}/.test(s) ? s : `${s}T19:00`;
  const d = new Date(`${local.slice(0, 16)}:00+05:30`);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

async function activeMember(id) {
  if (!isUuid(id)) return null;
  const { data } = await db().from("members").select("id, name, active").eq("id", id).maybeSingle();
  return data?.active ? data : null;
}

async function loadTask(id) {
  if (!isUuid(id)) return null;
  const { data } = await db().from("tasks").select(TASK_FIELDS).eq("id", id).maybeSingle();
  return data;
}

function refresh(task) {
  pingLive("tasks");
  revalidatePath("/tasks");
  revalidatePath(`/tasks/${task.id}`);
  revalidatePath(`/brands/${task.brand_id}`);
  revalidatePath("/brands");
  revalidatePath("/");
}

/* ------------------------------ Heads ------------------------------ */

export async function createTask(brandId, input) {
  const me = await requireMember();
  if (!canAssignTasks(me)) return { ok: false, error: "Only execution heads and admins assign tasks." };
  const brand = await getBrand(brandId);
  if (!brand) return { ok: false, error: "Brand not found." };
  const title = str(input.title, 160);
  if (!title) return { ok: false, error: "Give the task a title." };
  const kind = TASK_KINDS.some((k) => k.id === input.kind) ? input.kind : "other";
  const assignee = await activeMember(input.assignee_id);
  if (!assignee) return { ok: false, error: "Pick who does it." };
  if (!(await canAssignTo(me, assignee.id))) return { ok: false, error: "You can give tasks to your own team and to the other managers — not to another manager's team." };
  const due = dueAt(input.due_at);
  if (due === undefined) return { ok: false, error: "The due date isn't valid." };

  const priority = PRIORITIES.some((p) => p.id === input.priority) ? input.priority : "medium";
  const row = { brand_id: brandId, title, kind, brief: str(input.brief, 8000), assignee_id: assignee.id, assigned_by: me.id, due_at: due, priority };
  let { data: task, error } = await db().from("tasks").insert(row).select(TASK_FIELDS).single();
  if (error && /priority/.test(error.message)) {
    // Before migration 017: save without a priority
    const { priority: _skip, ...rest } = row;
    ({ data: task, error } = await db().from("tasks").insert(rest).select(TASK_FIELDS).single());
  }
  if (error) return { ok: false, error: error.message };
  await logTask(task.id, me.id, "created", { to: assignee.name });
  if (assignee.id !== me.id) after(() => notifyTask([assignee.id], task, priority === "high" ? "🔴 Urgent task assigned" : "New task assigned"));
  refresh(task);
  return { ok: true, id: task.id };
}

/** The Production people (team leads first) — for the "needs raw" part of the New task popup. */
export async function listProductionCrew() {
  await requireMember();
  return productionPeople();
}

/**
 * Ask Production for raw photos / footage for a design or video task. Makes a "shoot" task for the
 * production person (linked to this task); when they submit it, this task's designer / editor is told.
 */
export async function requestRaw(forId, input) {
  const me = await requireMember();
  const task = await loadTask(forId);
  if (!task) return { ok: false, error: "Task not found." };
  // Managers / admin, or the designer / editor doing the task themselves
  if (!canAssignTasks(me) && task.assignee_id !== me.id) return { ok: false, error: "Only the person doing this task or a manager can ask Production." };
  if (task.kind === "shoot") return { ok: false, error: "This is already a shoot." };
  const what = RAW_WHAT.some(([id]) => id === input.what) ? input.what : "photos";
  const label = RAW_WHAT.find(([id]) => id === what)[1];
  const crew = await productionPeople();
  const assignee = crew.find((p) => p.id === input.assignee_id);
  if (!assignee) return { ok: false, error: "Pick someone from the Production team." };
  const due = dueAt(input.due_at);
  if (due === undefined) return { ok: false, error: "The due date isn't valid." };
  const brief = str(input.brief, 8000);
  if (!brief) return { ok: false, error: "Write what to shoot — the brief." };

  const row = {
    brand_id: task.brand_id,
    title: `${label} for “${task.title}”`.slice(0, 160),
    kind: "shoot",
    brief,
    assignee_id: assignee.id,
    assigned_by: me.id,
    due_at: due,
    priority: task.priority || "medium",
    for_task_id: task.id,
  };
  const { data: shoot, error } = await db().from("tasks").insert(row).select(TASK_FIELDS).single();
  if (error) return { ok: false, error: /for_task_id|kind_check|shoot/.test(error.message) ? "Run migration 027_raw_requests.sql in Supabase first." : error.message };
  await Promise.all([logTask(shoot.id, me.id, "created", { to: assignee.name }), logTask(task.id, me.id, "raw_requested", { to: assignee.name, what: label.toLowerCase() })]);
  const maker = task.assignee?.name.split(" ")[0];
  after(async () => {
    if (assignee.id !== me.id) await notifyTask([assignee.id], shoot, "📸 Shoot needed", `${label} for ${maker ? `${maker}'s ` : ""}${taskKindLabel(task.kind).toLowerCase()} · ${task.brand?.name || ""}`);
    if (task.assignee_id && task.assignee_id !== me.id) await notifyTask([task.assignee_id], task, `${label} asked from ${assignee.name.split(" ")[0]}`, "You'll get a ping as soon as they're uploaded.");
    // The designer / editor asked themselves: let whoever gave them the task know
    if (task.assigned_by && task.assigned_by !== me.id && task.assignee_id === me.id) await notifyTask([task.assigned_by], task, `${me.name.split(" ")[0]} asked ${assignee.name.split(" ")[0]} for ${label.toLowerCase()}`, "A shoot task was created for Production.");
  });
  refresh(task);
  refresh(shoot);
  return { ok: true, id: shoot.id };
}

export async function updateTask(id, patch) {
  const me = await requireMember();
  const task = await loadTask(id);
  if (!task || !canAssignTasks(me)) return { ok: false, error: "You can't edit this task." };
  const changes = {};
  // Only what actually changed, so the person doing it is told exactly that
  if ("title" in patch) {
    const t = str(patch.title, 160);
    if (!t) return { ok: false, error: "The task needs a title." };
    if (t !== task.title) changes.title = t;
  }
  if ("brief" in patch && str(patch.brief, 8000) !== (task.brief || "")) changes.brief = str(patch.brief, 8000);
  if ("kind" in patch && patch.kind !== task.kind && TASK_KINDS.some((k) => k.id === patch.kind)) changes.kind = patch.kind;
  if ("priority" in patch && patch.priority !== (task.priority || "medium") && PRIORITIES.some((p) => p.id === patch.priority)) changes.priority = patch.priority;
  if ("due_at" in patch) {
    const due = dueAt(patch.due_at);
    if (due === undefined) return { ok: false, error: "The due date isn't valid." };
    if ((due || null) !== (task.due_at ? new Date(task.due_at).toISOString() : null)) {
      changes.due_at = due;
      changes.due_soon_notified_at = null;
      changes.overdue_notified_at = null;
    }
  }
  let newAssignee = null;
  if ("assignee_id" in patch && patch.assignee_id !== task.assignee_id) {
    newAssignee = await activeMember(patch.assignee_id);
    if (!newAssignee) return { ok: false, error: "Pick who does it." };
    if (!(await canAssignTo(me, newAssignee.id))) return { ok: false, error: "You can give tasks to your own team and to the other managers — not to another manager's team." };
    changes.assignee_id = newAssignee.id;
  }
  if (!Object.keys(changes).length) return { ok: true };
  changes.updated_at = new Date().toISOString();
  const { error } = await db().from("tasks").update(changes).eq("id", id);
  if (error) return { ok: false, error: /priority/.test(error.message) ? "Priority needs migration 017 — ask the admin to run it." : error.message };
  const fields = Object.keys(changes).filter((k) => !k.endsWith("_at") || k === "due_at");
  await logTask(id, me.id, "edited", { fields, to: newAssignee?.name });
  const after_ = { ...task, ...changes };
  const first = me.name.split(" ")[0];
  if (newAssignee) {
    if (newAssignee.id !== me.id) after(() => notifyTask([newAssignee.id], after_, "Task assigned to you"));
    // The person it was taken from should know too
    if (task.assignee_id && task.assignee_id !== me.id) after(() => notifyTask([task.assignee_id], after_, "Task moved", `${first} gave it to ${newAssignee.name.split(" ")[0]}`));
  } else if (task.assignee_id && task.assignee_id !== me.id) {
    const LABEL = { title: "title", brief: "brief", kind: "type", priority: "priority", due_at: "due date" };
    const what = fields.map((f) => LABEL[f]).filter(Boolean);
    const due = changes.due_at ? ` — now due ${new Date(changes.due_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}` : "";
    if (what.length) after(() => notifyTask([task.assignee_id], after_, "✏️ Task updated", `${first} changed the ${what.join(", ").replace(/, ([^,]*)$/, " and $1")}${due}`));
  }
  refresh(task);
  return { ok: true };
}

export async function deleteTask(id) {
  const me = await requireMember();
  const task = await loadTask(id);
  if (!task || !canAssignTasks(me)) return { ok: false, error: "You can't delete this task." };
  const { data: files } = await db().from("task_files").select("storage_path").eq("task_id", id);
  const paths = (files || []).map((f) => f.storage_path).filter(Boolean);
  if (paths.length) await db().storage.from(BUCKET).remove(paths);
  await db().from("tasks").delete().eq("id", id);
  refresh(task);
  return { ok: true };
}

/**
 * The head's moves after the employee marks a task Completed, and after the client's answer:
 *   send_back      completed → revision (feedback goes to the employee)
 *   share_client   completed → with the client for approval
 *   approve        completed → done (internal work that needs no client approval)
 *   client_ok      with client → done (until the client dashboard is live, the team records the answer)
 *   client_changes with client → client asked for changes (feedback)
 *   reassign       client asked for changes / completed → revision, to the same or another person
 */
export async function reviewTask(id, action, { feedback = "", assignee_id, due_at } = {}) {
  const me = await requireMember();
  const task = await loadTask(id);
  if (!task || !canReviewTask(me, task) || !canAssignTasks(me)) return { ok: false, error: "Only the execution heads review tasks." };
  const now = new Date().toISOString();
  const note = str(feedback, 4000);
  const from = task.status;
  let changes;
  let notify = null;
  let alsoNotify = null;
  const clientRevision = () => ({
    status: "revision",
    revision: task.revision + 1,
    feedback: note,
    due_soon_notified_at: null,
    overdue_notified_at: null,
  });

  switch (action) {
    case "send_back":
      if (from !== "completed") return { ok: false, error: "Only completed work can be sent back." };
      if (!note) return { ok: false, error: "Tell them what to change." };
      changes = { status: "revision", revision: task.revision + 1, feedback: note };
      notify = { to: [task.assignee_id], title: "Revision needed", body: note.slice(0, 140) };
      break;
    case "ready":
      // The team lead approved it — a CBO shares it with the client by hand
      if (from !== "completed") return { ok: false, error: "Only completed work can be approved." };
      changes = { status: "ready", feedback: "" };
      notify = { to: [task.assignee_id], title: "Approved", body: "Approved — it goes to the client next." };
      alsoNotify = { to: (await sharerIds()).filter((x) => x !== me.id && x !== task.assignee_id), title: "✅ Ready to share with the client", body: `${me.name.split(" ")[0]} approved it · ${task.brand?.name || ""} — download and share it.` };
      break;
    case "share_client":
      // Shared with the client (by hand, on WhatsApp / mail)
      if (!["completed", "ready"].includes(from)) return { ok: false, error: "Approve the work first." };
      changes = { status: "sent_to_client", feedback: "" };
      break;
    case "approve":
      if (from !== "completed") return { ok: false, error: "Only completed work can be approved." };
      changes = { status: "done", done_at: now, feedback: "" };
      notify = { to: [task.assignee_id], title: "Approved", body: "Nice work — it's done." };
      break;
    case "client_ok":
      if (!["sent_to_client", "ready"].includes(from)) return { ok: false, error: "It isn't with the client." };
      changes = { status: "done", done_at: now, feedback: "" };
      notify = { to: [task.assignee_id], title: "Client approved", body: "The client approved it." };
      break;
    case "client_changes":
      // The client wants changes: straight back to the designer / editor as a revision
      if (!["sent_to_client", "ready"].includes(from)) return { ok: false, error: "It isn't with the client." };
      if (!note) return { ok: false, error: "Write what the client wants changed." };
      changes = clientRevision();
      notify = { to: [task.assignee_id], title: "Client wants changes", body: note.slice(0, 140) };
      alsoNotify = { to: [task.assigned_by].filter((x) => x && x !== me.id && x !== task.assignee_id), title: "Client asked for changes", body: note.slice(0, 140) };
      break;
    case "reassign": {
      if (!["client_rejected", "completed"].includes(from)) return { ok: false, error: "Nothing to reassign." };
      const person = await activeMember(assignee_id || task.assignee_id);
      if (!person) return { ok: false, error: "Pick who does the revision." };
      if (person.id !== task.assignee_id && !(await canAssignTo(me, person.id))) return { ok: false, error: "You can give tasks to your own team and to the other managers — not to another manager's team." };
      const due = due_at ? dueAt(due_at) : task.due_at;
      if (due === undefined) return { ok: false, error: "The due date isn't valid." };
      changes = {
        status: "revision",
        revision: task.revision + 1,
        assignee_id: person.id,
        feedback: note || task.feedback,
        due_at: due,
        due_soon_notified_at: null,
        overdue_notified_at: null,
      };
      notify = { to: [person.id], title: person.id === task.assignee_id ? "Revision needed" : "Revision assigned to you", body: (note || task.feedback).slice(0, 140) };
      break;
    }
    default:
      return { ok: false, error: "Unknown action." };
  }

  changes.updated_at = now;
  const { error } = await db().from("tasks").update(changes).eq("id", id).eq("status", from);
  if (error) return { ok: false, error: /status_check/.test(error.message) ? "Run migration 028_ready_for_client.sql in Supabase first." : error.message };
  await logTask(id, me.id, action, { feedback: note || undefined, to: changes.assignee_id && changes.assignee_id !== task.assignee_id ? "new" : undefined, revision: changes.revision });
  if (notify?.to?.length) after(() => notifyTask(notify.to, task, notify.title, notify.body));
  if (alsoNotify?.to?.length) after(() => notifyTask(alsoNotify.to, task, alsoNotify.title, alsoNotify.body));
  // A content-calendar post approved for good goes to the Social Media team to post
  if (changes.status === "done") {
    const posting = await queuePosting(task, me);
    if (posting) refresh(posting);
  }
  refresh(task);
  return { ok: true };
}

/* ------------------------------ Employee ------------------------------ */

/** The dropdown on the employee's task: To do / In progress / Completed. */
export async function setTaskStatus(id, status) {
  const me = await requireMember();
  const task = await loadTask(id);
  if (!task) return { ok: false, error: "Task not found." };
  const mine = task.assignee_id === me.id;
  if (!mine && !canAssignTasks(me)) return { ok: false, error: "This task isn't yours." };
  if (!MAKER_STATUS_OPTIONS.includes(status) && status !== "revision") return { ok: false, error: "Unknown status." };
  if (!["assigned", "in_progress", "revision", "completed"].includes(task.status)) {
    return { ok: false, error: `It's "${TASK_STATUSES[task.status].label}" — the head moves it from here.` };
  }
  if (status === task.status) return { ok: true };
  if (status === "completed") {
    const { count } = await db()
      .from("task_files")
      .select("id", { count: "exact", head: true })
      .eq("task_id", id)
      .eq("role", "deliverable")
      .eq("revision", task.revision);
    // A note counts too — not every task ends in a file (e.g. "called the vendor, it's sorted")
    const { count: notes } = count
      ? { count }
      : await db().from("task_events").select("id", { count: "exact", head: true }).eq("task_id", id).eq("type", "note").eq("data->>revision", String(task.revision));
    if (!count && !notes) return { ok: false, error: "Upload the file, add a link or write a note before marking it completed." };
  }
  if (task.status === "completed" && !canAssignTasks(me)) return { ok: false, error: "It's with your manager for review now." };
  // A revision stays a revision until it's completed again
  const next = status === "assigned" && task.revision > 0 ? "revision" : status;
  const now = new Date().toISOString();
  const { error } = await db()
    .from("tasks")
    .update({ status: next, updated_at: now, ...(next === "completed" ? { completed_at: now } : {}) })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  await logTask(id, me.id, "status", { from: task.status, to: next });
  const main = next === "completed" && task.for_task_id ? await loadTask(task.for_task_id) : null;
  if (next === "completed" && task.assigned_by && task.assigned_by !== me.id && task.assigned_by !== main?.assignee_id) {
    after(() => notifyTask([task.assigned_by], task, `${me.name} completed`, task.revision ? `Revision ${task.revision} is ready for review.` : "Ready for your review."));
  }
  // A shoot for another task: tell that task's designer / editor the raw files are up
  if (main) {
    await logTask(main.id, me.id, "raw_ready", { title: task.title });
    if (main.assignee_id && main.assignee_id !== me.id) after(() => notifyTask([main.assignee_id], main, "📸 Raw files are ready", `${me.name.split(" ")[0]} uploaded them — open the task and start.`));
    refresh(main);
  }
  refresh(task);
  return { ok: true };
}

/** Upload URL for a deliverable / reference file on a task. */
export async function startTaskUpload(id, fileName, size) {
  const me = await requireMember();
  const task = await loadTask(id);
  if (!task || (task.assignee_id !== me.id && !canAssignTasks(me) && !(task.kind === "shoot" && task.assigned_by === me.id))) return { ok: false, error: "This task isn't yours." };
  if (!(size > 0) || size > MAX_FILE) return { ok: false, error: "Files must be under 50 MB for now — add bigger videos as a link." };
  const safe = str(fileName, 120).replace(/[^\w.\-]+/g, "_") || "file";
  const path = `tasks/${task.id}/${Date.now()}-${safe}`;
  const { data, error } = await db().storage.from(BUCKET).createSignedUploadUrl(path);
  if (error) return { ok: false, error: error.message };
  return { ok: true, path: data.path, token: data.token };
}

export async function addTaskFile(id, { path, url, name, size, role = "deliverable" }) {
  const me = await requireMember();
  const task = await loadTask(id);
  if (!task || (task.assignee_id !== me.id && !canAssignTasks(me) && !(task.kind === "shoot" && task.assigned_by === me.id))) return { ok: false, error: "This task isn't yours." };
  const row = { task_id: id, revision: task.revision, role: role === "reference" ? "reference" : "deliverable", uploaded_by: me.id };
  if (path) {
    if (!String(path).startsWith(`tasks/${id}/`)) return { ok: false, error: "Upload not recognised." };
    Object.assign(row, { storage_path: path, name: str(name, 200), size: Number(size) || 0 });
  } else {
    const u = str(url, 1000);
    if (!/^https?:\/\/\S+$/i.test(u)) return { ok: false, error: "Paste a full link starting with https://" };
    Object.assign(row, { url: u, name: str(name, 200) || u.replace(/^https?:\/\//, "").slice(0, 80) });
  }
  const { error } = await db().from("task_files").insert(row);
  if (error) return { ok: false, error: error.message };
  await logTask(id, me.id, row.role === "reference" ? "reference" : "file", { name: row.name, revision: task.revision });
  refresh(task);
  return { ok: true };
}

/** A written update on the work — on its own or alongside the files. Saved per version, like files. */
export async function addTaskNote(id, text) {
  const me = await requireMember();
  const task = await loadTask(id);
  if (!task || (task.assignee_id !== me.id && !canAssignTasks(me))) return { ok: false, error: "This task isn't yours." };
  if (["sent_to_client", "done"].includes(task.status)) return { ok: false, error: "This work is already with the client." };
  const body = str(text, 4000);
  if (!body) return { ok: false, error: "Write the note first." };
  await logTask(id, me.id, "note", { text: body, revision: task.revision });
  refresh(task);
  return { ok: true };
}

export async function removeTaskFile(fileId) {
  const me = await requireMember();
  if (!isUuid(fileId)) return { ok: false, error: "File not found." };
  const { data: f } = await db().from("task_files").select("id, task_id, storage_path, uploaded_by").eq("id", fileId).maybeSingle();
  if (!f) return { ok: false, error: "File not found." };
  const task = await loadTask(f.task_id);
  if (f.uploaded_by !== me.id && !canAssignTasks(me)) return { ok: false, error: "You can only remove your own files." };
  if (task && ["sent_to_client", "done"].includes(task.status)) return { ok: false, error: "This work is already with the client." };
  if (f.storage_path) await db().storage.from(BUCKET).remove([f.storage_path]);
  await db().from("task_files").delete().eq("id", fileId);
  if (task) refresh(task);
  return { ok: true };
}

/**
 * Pause a task — e.g. to make room for something urgent. The manager or the person doing it can do
 * it; a reason is required. The other side gets a notification.
 */
export async function holdTask(id, reason) {
  const me = await requireMember();
  const task = await loadTask(id);
  if (!task) return { ok: false, error: "Task not found." };
  const mine = task.assignee_id === me.id;
  if (!mine && !canAssignTasks(me)) return { ok: false, error: "This task isn't yours." };
  if (!OPEN_TASK.includes(task.status)) return { ok: false, error: "Only work that's to do or in progress can go on hold." };
  const why = str(reason, 1000);
  if (why.length < 3) return { ok: false, error: "Write why it's going on hold." };
  const now = new Date().toISOString();
  const { error } = await db().from("tasks").update({ status: "on_hold", held_from: task.status, hold_reason: why, held_at: now, held_by: me.id, updated_at: now }).eq("id", id);
  if (error) return { ok: false, error: /on_hold|hold_reason|check/.test(error.message) ? "Run migration 025 in Supabase first." : error.message };
  await logTask(id, me.id, "hold", { reason: why });
  const tell = [mine ? task.assigned_by : task.assignee_id].filter((x) => x && x !== me.id);
  if (tell.length) after(() => notifyTask(tell, task, `⏸ Put on hold by ${me.name.split(" ")[0]}`, why));
  refresh(task);
  return { ok: true };
}

/** Pick it back up: the task returns to where it was before the hold. */
export async function resumeTask(id) {
  const me = await requireMember();
  const task = await loadTask(id);
  if (!task) return { ok: false, error: "Task not found." };
  const mine = task.assignee_id === me.id;
  if (!mine && !canAssignTasks(me)) return { ok: false, error: "This task isn't yours." };
  if (task.status !== "on_hold") return { ok: true };
  const back = OPEN_TASK.includes(task.held_from) ? task.held_from : "assigned";
  const now = new Date().toISOString();
  const { error } = await db().from("tasks").update({ status: back, updated_at: now }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  await logTask(id, me.id, "resume", { to: back });
  const tell = [mine ? task.assigned_by : task.assignee_id].filter((x) => x && x !== me.id);
  if (tell.length) after(() => notifyTask(tell, task, `▶ Back on — ${me.name.split(" ")[0]} resumed it`));
  refresh(task);
  return { ok: true };
}

/* ------------------------------ Posting ------------------------------ */

/** The posting kit for a calendar post: details, final files, caption, and whether it's posted. */
export async function getPostingKit(itemId) {
  const me = await requireMember();
  if (!isUuid(itemId)) return { ok: false, error: "Not found." };
  const kit = await postingKit(itemId);
  if (!kit) return { ok: false, error: "Not found." };
  const mine = kit.posting?.assignee?.id === me.id;
  if (!canSeeCalendar(me) && !canAssignTasks(me) && !mine) return { ok: false, error: "You can't see this post." };
  return { ok: true, kit, canPost: canPostContent(me) || mine, canUndo: canUndoPost(me) };
}

/** Admin and the CBOs (Krrish, Udit) can take a post back. */
const canUndoPost = (me) => me.role === "admin" || isOpsHead(me);

/** Posted it (on Instagram etc.): the calendar post becomes Posted and the posting task is done. The post's link is required. */
export async function markPosted(itemId, url = "") {
  const me = await requireMember();
  const kit = isUuid(itemId) ? await postingKit(itemId) : null;
  if (!kit) return { ok: false, error: "Not found." };
  const mine = kit.posting?.assignee?.id === me.id;
  if (!canPostContent(me) && !mine) return { ok: false, error: "Only the Social Media team marks posts as posted." };
  if (!kit.approved && me.role !== "admin") return { ok: false, error: "The client hasn't approved it yet." };
  const link = str(url, 1000);
  if (!link) return { ok: false, error: "Paste the link of the live post first (Instagram / LinkedIn / YouTube…)." };
  if (!/^https?:\/\/\S+\.\S+$/i.test(link)) return { ok: false, error: "Paste the full post link, starting with https://" };
  const now = new Date().toISOString();
  const { error } = await db().from("calendar_items").update({ status: "posted", posted_at: now, posted_by: me.id, post_url: link, updated_at: now }).eq("id", itemId);
  if (error) return { ok: false, error: /posted_at|posted_by|post_url/.test(error.message) ? "Run migration 029_posting.sql in Supabase first." : error.message };
  if (kit.posting && kit.posting.status !== "done") {
    const posting = await loadTask(kit.posting.id);
    await db().from("tasks").update({ status: "done", done_at: now, updated_at: now }).eq("id", posting.id);
    await logTask(posting.id, me.id, "posted", { url: link || undefined });
    if (posting.assigned_by && posting.assigned_by !== me.id) after(() => notifyTask([posting.assigned_by], posting, "✅ Posted", `${me.name.split(" ")[0]} posted it${link ? " — tap to see the task and the link" : ""}.`));
    refresh(posting);
  }
  pingLive("calendar");
  revalidatePath("/calendar");
  revalidatePath(`/brands/${kit.item.brand_id}`);
  return { ok: true };
}

/**
 * Admin / CBOs: take a post back (wrong post, needs a re-post…) with a reason. The post goes back to waiting and
 * its posting task goes back to the Social Media team (Nilav) as "To do", with the reason, so they post it again.
 */
export async function unmarkPosted(itemId, reason = "") {
  const me = await requireMember();
  if (!canUndoPost(me)) return { ok: false, error: "Only admin and the CBOs can undo a post." };
  const why = str(reason, 1000);
  if (why.length < 3) return { ok: false, error: "Write why it's being undone — the Social Media team sees this." };
  const kit = isUuid(itemId) ? await postingKit(itemId) : null;
  if (!kit) return { ok: false, error: "Not found." };
  const now = new Date().toISOString();
  const { error } = await db().from("calendar_items").update({ status: "planned", posted_at: null, posted_by: null, post_url: "", updated_at: now }).eq("id", itemId);
  if (error) return { ok: false, error: error.message };
  // The posting task: reopen it — or, if it never had one (posted from the calendar), make one now
  let posting = kit.posting ? await loadTask(kit.posting.id) : null;
  if (posting) {
    await db().from("tasks").update({ status: "assigned", done_at: null, updated_at: now }).eq("id", posting.id);
  } else {
    const { data: item } = await db().from("calendar_items").select("task_id").eq("id", itemId).maybeSingle();
    const work = item?.task_id ? await loadTask(item.task_id) : null;
    posting = work ? await queuePosting(work, me) : null;
  }
  if (posting) {
    await logTask(posting.id, me.id, "unposted", { reason: why, url: kit.item.post_url || undefined });
    const to = posting.assignee_id || posting.assignee?.id;
    if (to && to !== me.id) after(() => notifyTask([to], posting, "↩️ Post it again", `${me.name.split(" ")[0]} undid the post: ${why}`));
    refresh(posting);
  }
  pingLive("calendar");
  revalidatePath("/calendar");
  return { ok: true };
}
