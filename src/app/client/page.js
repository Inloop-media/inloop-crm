import { redirect } from "next/navigation";
import Logo from "@/components/Logo";
import Icon from "@/components/Icon";
import ThemeToggle from "@/components/ThemeToggle";
import { Avatar, Empty } from "@/components/ui";
import Decide from "./Decide";
import ClientChatDock from "./ClientChatDock";
import { CLIENT, loadChat } from "@/lib/chat";
import { getCurrentClient } from "@/lib/clients";
import { db } from "@/lib/supabase/server";
import { getTheme } from "@/lib/theme";
import { taskKindLabel } from "@/lib/constants";
import { fmtDay } from "@/lib/format";

export const metadata = { title: "Your dashboard" };

const isImg = (n) => /\.(jpe?g|png|webp|gif)$/i.test(n || "");
const isVid = (n) => /\.(mp4|mov|webm|m4v)$/i.test(n || "");

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
    pending: shown.filter((t) => t.status === "sent_to_client").map(withFiles),
    approved: shown.filter((t) => t.status === "done").map(withFiles),
    inProduction: all.filter((t) => !["sent_to_client", "done"].includes(t.status)).length,
  };
}

function Media({ f, title, big }) {
  const cls = `w-full bg-panel-2 ${big ? "max-h-[70vh] object-contain" : "aspect-square object-cover"}`;
  if (isImg(f.name) && f.href)
    // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
    return <img src={f.href} alt={title} className={cls} loading="lazy" />;
  if (isVid(f.name) && f.href) return <video src={f.href} className={`${cls} bg-black`} controls={big} muted={!big} playsInline preload="metadata" />;
  return (
    <a href={f.href} target="_blank" rel="noreferrer" className={`grid place-items-center gap-2 p-6 text-sm text-muted ${big ? "min-h-40" : "aspect-square"} bg-panel-2`}>
      <Icon name={f.storage_path ? "file" : "link"} size={22} />
      <span className="max-w-full truncate px-2">{f.name}</span>
    </a>
  );
}

export default async function ClientHome() {
  const client = await getCurrentClient();
  if (!client) redirect("/login");
  const brand = client.brand;
  const [{ pending, approved, inProduction }, theme, chat] = await Promise.all([clientWork(brand.id), getTheme(), loadChat(brand.id)]);
  const lastReadAt = chat.mine[CLIENT] || null;
  const unread = chat.messages.filter((m) => !m.from_client && (!lastReadAt || m.created_at > lastReadAt)).length;

  return (
    <div className="min-h-svh md:p-4 lg:p-5">
      <div className="md:frame min-h-[calc(100svh-2.5rem)]">
        <header className="flex items-center gap-3 px-4 pt-5 sm:px-8">
          <Logo compact />
          <span className="flex-1" />
          <ThemeToggle initial={theme} variant="row" />
          <form action="/auth/signout" method="post">
            <button className="btn-ghost btn-sm">
              <Icon name="logout" size={13} /> Sign out
            </button>
          </form>
        </header>

        <main className="page max-w-6xl">
          <div className="grid gap-x-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0">
          <section className="rise card relative mt-2 overflow-hidden p-6 sm:p-8">
            <span className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full blur-3xl" style={{ background: "color-mix(in srgb, #8b93ff 25%, transparent)" }} />
            <div className="relative flex flex-wrap items-center gap-4">
              <Avatar name={brand.name} size={56} />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-muted">Welcome to the Loop</p>
                <h1 className="text-[28px] font-medium leading-tight tracking-[-0.02em] md:text-[36px]">{brand.name}</h1>
              </div>
            </div>
            <div className="relative mt-6 grid grid-cols-3 gap-2 text-center sm:max-w-md">
              {[
                ["To review", pending.length],
                ["In production", inProduction],
                ["Approved", approved.length],
              ].map(([l, v]) => (
                <div key={l} className="well px-2 py-3">
                  <div className="text-2xl font-medium">{v}</div>
                  <div className="text-[11px] text-muted">{l}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="rise rise-2 mt-8">
            <h2 className="mb-1 text-xl font-medium tracking-[-0.015em]">Waiting for your approval</h2>
            <p className="mb-4 text-sm text-muted">Approve it, or tell us what to change — the team gets it straight away.</p>
            {pending.length ? (
              <div className="grid gap-5 md:grid-cols-2">
                {pending.map((t) => (
                  <article key={t.id} className="card overflow-hidden">
                    <div className="flex flex-col gap-1">
                      {t.files.length ? t.files.slice(0, 3).map((f) => <Media key={f.id} f={f} title={t.title} big />) : <div className="well-empty m-4 p-8 text-center text-sm text-muted">No file attached.</div>}
                    </div>
                    <div className="flex flex-col gap-4 p-5">
                      <div>
                        <div className="flex items-center gap-2 text-xs text-muted">
                          <span className="rounded-full bg-panel-2 px-2 py-0.5 font-medium">{taskKindLabel(t.kind)}</span>
                          {t.revision > 0 && <span>Updated version</span>}
                        </div>
                        <h3 className="mt-2 text-base font-medium">{t.title}</h3>
                      </div>
                      <Decide taskId={t.id} />
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="card">
                <Empty icon="check">Nothing waiting for you right now. New work shows up here as soon as it&apos;s ready.</Empty>
              </div>
            )}
          </section>

          <section className="rise rise-3 mt-10">
            <h2 className="mb-4 text-xl font-medium tracking-[-0.015em]">Approved work</h2>
            {approved.length ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {approved.flatMap((t) =>
                  (t.files.length ? t.files : [{ id: t.id, name: "", href: "" }]).slice(0, 1).map((f) => (
                    <a key={f.id} href={f.href || undefined} target="_blank" rel="noreferrer" className="card overflow-hidden">
                      <Media f={f} title={t.title} />
                      <div className="px-3 py-2.5">
                        <div className="truncate text-xs font-medium">{t.title}</div>
                        <div className="text-[11px] text-muted">
                          {taskKindLabel(t.kind)} · {fmtDay(t.done_at)}
                        </div>
                      </div>
                    </a>
                  ))
                )}
              </div>
            ) : (
              <div className="card">
                <Empty icon="file">Everything you approve collects here.</Empty>
              </div>
            )}
          </section>
          </div>

          <aside className="rise rise-2 lg:mt-2">
            <ClientChatDock brandId={brand.id} brandName={brand.name} initial={{ messages: chat.messages, reads: chat.reads }} lastReadAt={lastReadAt} unread={unread} />
          </aside>
          </div>
        </main>
      </div>
    </div>
  );
}
