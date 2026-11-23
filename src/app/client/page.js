import { redirect } from "next/navigation";
import ClientView from "@/components/ClientView";
import { CLIENT, chatMembers, loadChat } from "@/lib/chat";
import { getCurrentClient } from "@/lib/clients";
import { db } from "@/lib/supabase/server";
import { getTheme } from "@/lib/theme";
import { upcomingItems } from "@/lib/calendar";
import { CLIENT_PORTAL_REVIEW } from "@/lib/constants";

export const metadata = { title: "Your dashboard" };


/** The brand's tasks that are with them or approved, each with the files of its current version. */
async function clientWork(brandId) {
  const { data: tasks } = await db()
    .from("tasks")
    .select("id, title, kind, brief, status, revision, done_at, updated_at")
    .eq("brand_id", brandId)
    .order("updated_at", { ascending: false })
    .limit(500);
  const all = tasks || [];
  const shown = all.filter((t) => t.status === "sent_to_client" || t.status === "done");
  let files = [];
  if (shown.length) {
    const { data } = await db().from("task_files").select("id, task_id, revision, name, storage_path, url").in("task_id", shown.map((t) => t.id)).eq("role", "deliverable");
    files = data || [];
  }
  const paths = files.filter((f) => f.storage_path).map((f) => f.storage_path);
  let signed = {};
  if (paths.length) {
    const { data } = await db().storage.from("lead-docs").createSignedUrls(paths, 3600);
    signed = Object.fromEntries((data || []).filter((x) => x.signedUrl).map((x) => [x.path, x.signedUrl]));
  }
  const withFiles = (t) => ({
    ...t,
    files: files.filter((f) => f.task_id === t.id && f.revision === t.revision).map((f) => ({ ...f, href: f.storage_path ? signed[f.storage_path] || "" : f.url })),
  });
  return {
    // Paused for now: a CBO shares work with the client by hand and records their answer
    pending: CLIENT_PORTAL_REVIEW ? shown.filter((t) => t.status === "sent_to_client").map(withFiles) : [],
    approved: shown.filter((t) => t.status === "done").map(withFiles),
    inProduction: all.filter((t) => !["sent_to_client", "done"].includes(t.status)).length,
  };
}

export default async function ClientHome() {
  const client = await getCurrentClient();
  if (!client) redirect("/login");
  const brand = client.brand;
  const [{ pending, approved, inProduction }, theme, chat, upcoming, members] = await Promise.all([clientWork(brand.id), getTheme(), loadChat(brand.id), upcomingItems(brand.id), chatMembers()]);
  const lastReadAt = chat.mine[CLIENT] || null;
  const unread = chat.messages.filter((m) => !m.from_client && (!lastReadAt || m.created_at > lastReadAt)).length;

  return <ClientView brand={brand} pending={pending} approved={approved} inProduction={inProduction} theme={theme} chat={chat} upcoming={upcoming} lastReadAt={lastReadAt} unread={unread} members={members} />;
}
