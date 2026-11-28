"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth";
import { db } from "@/lib/supabase/server";
import { getBrand } from "@/lib/brands";
import { canAssignTasks } from "@/lib/permissions";
import { logTask } from "@/lib/tasks";
import { pingLive } from "@/lib/live";
import { brandFolders, driveConnection, ensurePath, fileInfo, setupBrand, shareWithLink, startUpload } from "@/lib/drive";

const str = (v, max) => String(v ?? "").trim().slice(0, max);
const fail = (err) => ({ ok: false, error: String(err?.message || err || "Something went wrong.").slice(0, 300) });

/** Admin: make the standard folder tree for one brand (the Brands page runs it brand by brand). */
export async function setupBrandDrive(brandId) {
  const me = await requireMember();
  if (me.role !== "admin") return { ok: false, error: "Only admin sets up Drive." };
  const brand = await getBrand(brandId);
  if (!brand) return { ok: false, error: "Brand not found." };
  try {
    await setupBrand(brand, me.id);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

/** A brand's Drive folders for the task form: { connected, folders: [{ drive_id, path }] } (made if missing). */
export async function driveFoldersFor(brandId) {
  const me = await requireMember();
  if (!canAssignTasks(me)) return { ok: false, error: "Only people who give tasks pick folders." };
  const conn = await driveConnection();
  if (!conn?.root_id) return { ok: true, connected: false, folders: [] };
  const brand = await getBrand(brandId);
  if (!brand) return { ok: false, error: "Brand not found." };
  try {
    let folders = await brandFolders(brand.id);
    if (folders.length < 5) {
      await setupBrand(brand, me.id);
      folders = await brandFolders(brand.id);
    }
    return { ok: true, connected: true, folders };
  } catch (err) {
    return fail(err);
  }
}

/** "+ New folder" inside a brand folder (parentPath "" = the brand folder itself). */
export async function newDriveFolder(brandId, parentPath, name) {
  const me = await requireMember();
  if (!canAssignTasks(me)) return { ok: false, error: "Only people who give tasks make folders." };
  const brand = await getBrand(brandId);
  if (!brand) return { ok: false, error: "Brand not found." };
  const n = str(name, 100);
  if (!n) return { ok: false, error: "Name the folder." };
  try {
    const parent = String(parentPath || "").split(" / ").filter(Boolean);
    const f = await ensurePath(brand, [...parent, n], me.id);
    return { ok: true, folder: f };
  } catch (err) {
    return fail(err);
  }
}

/** The Drive folders (each with a note) a task's work goes into. Replaces the list. */
export async function setTaskFolders(taskId, folders) {
  const me = await requireMember();
  if (!canAssignTasks(me)) return { ok: false, error: "Only people who give tasks pick folders." };
  const { data: task } = await db().from("tasks").select("id, brand_id").eq("id", taskId).maybeSingle();
  if (!task) return { ok: false, error: "Task not found." };
  const known = new Map((await brandFolders(task.brand_id)).map((f) => [f.drive_id, f.path]));
  const rows = (Array.isArray(folders) ? folders : [])
    .filter((f) => known.has(f?.drive_id))
    .slice(0, 30)
    .map((f, i) => ({ task_id: task.id, drive_id: f.drive_id, path: known.get(f.drive_id), note: str(f.note, 300), sort: i }));
  const seen = new Set();
  const unique = rows.filter((r) => !seen.has(r.drive_id) && seen.add(r.drive_id));
  await db().from("task_folders").delete().eq("task_id", task.id);
  if (unique.length) {
    const { error } = await db().from("task_folders").insert(unique);
    if (error) return fail(/task_folders/.test(error.message) ? "Run migration 035_drive.sql in Supabase first." : error.message);
  }
  revalidatePath(`/tasks/${task.id}`);
  return { ok: true };
}

/** Whoever does the task (or a head) uploads into one of its folders: a Google upload link for the browser. */
async function taskAndFolder(me, taskId, folderId) {
  const { data: task } = await db().from("tasks").select("id, assignee_id, assigned_by, kind, status, revision, brand_id").eq("id", taskId).maybeSingle();
  if (!task) return { error: "Task not found." };
  if (task.assignee_id !== me.id && !canAssignTasks(me) && !(task.kind === "shoot" && task.assigned_by === me.id)) return { error: "This task isn't yours." };
  if (["sent_to_client", "done"].includes(task.status)) return { error: "This work is already with the client." };
  const { data: folder } = await db().from("task_folders").select("drive_id, path").eq("task_id", task.id).eq("drive_id", folderId).maybeSingle();
  if (!folder) return { error: "That folder isn't on this task." };
  return { task, folder };
}

export async function startDriveUpload(taskId, folderId, file) {
  const me = await requireMember();
  const { task, folder, error } = await taskAndFolder(me, taskId, folderId);
  if (error) return { ok: false, error };
  if (!(Number(file?.size) > 0)) return { ok: false, error: "That file is empty." };
  try {
    const h = await headers();
    const origin = h.get("origin") || `https://${h.get("host")}`;
    const url = await startUpload(folder.drive_id, { name: str(file.name, 200), size: Number(file.size), type: str(file.type, 100) }, origin);
    return { ok: true, url, task: task.id };
  } catch (err) {
    return fail(err);
  }
}

/** After the browser sent the file: check it's in the folder and add it to the task (link only). */
export async function finishDriveUpload(taskId, folderId, driveFileId) {
  const me = await requireMember();
  const { task, folder, error } = await taskAndFolder(me, taskId, folderId);
  if (error) return { ok: false, error };
  try {
    const f = await fileInfo(driveFileId);
    if (!(f.parents || []).includes(folder.drive_id)) return { ok: false, error: "The upload didn't land in the task's folder." };
    const row = {
      task_id: task.id,
      revision: task.revision || 0,
      role: "deliverable",
      name: str(f.name, 200),
      url: f.webViewLink || `https://drive.google.com/file/d/${f.id}/view`,
      size: Number(f.size) || 0,
      uploaded_by: me.id,
      drive_file_id: f.id,
      drive_folder_id: folder.drive_id,
    };
    const { error: e } = await db().from("task_files").insert(row);
    if (e) return fail(e);
    await logTask(task.id, me.id, "file", { name: row.name, revision: row.revision, folder: folder.path });
    pingLive("tasks");
    revalidatePath(`/tasks/${task.id}`);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

/** Managers: a view-only link to one of a task's Drive folders (or a file uploaded to it), to send the client. */
export async function clientLink(taskId, driveId) {
  const me = await requireMember();
  if (!canAssignTasks(me)) return { ok: false, error: "Only managers share Drive links with clients." };
  const id = str(driveId, 200);
  const [{ data: folder }, { data: file }] = await Promise.all([
    db().from("task_folders").select("path").eq("task_id", taskId).eq("drive_id", id).maybeSingle(),
    db().from("task_files").select("name").eq("task_id", taskId).eq("drive_file_id", id).maybeSingle(),
  ]);
  if (!folder && !file) return { ok: false, error: "That isn't on this task." };
  try {
    const url = await shareWithLink(id);
    await logTask(taskId, me.id, "note", { text: `Shared a view-only link with the client: ${folder?.path || file?.name}`, link: url }).catch(() => {});
    return { ok: true, url };
  } catch (err) {
    return fail(err);
  }
}
