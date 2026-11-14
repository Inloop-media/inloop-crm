import Link from "next/link";
import { notFound } from "next/navigation";
import Icon from "@/components/Icon";
import { Avatar, Empty, PageHeader, Panel, StatStrip } from "@/components/ui";
import { Progress, TaskList } from "@/components/Tasks";
import { NewTaskForm } from "@/components/TaskForms";
import BrandChat from "@/components/BrandChat";
import { brandChat, brandChatUpload, markBrandRead, sendBrandMessage } from "../actions";
import { loadChat, unreadCounts } from "@/lib/chat";
import { requireMember } from "@/lib/auth";
import { getBrand } from "@/lib/brands";
import { listMakers, listTasks } from "@/lib/tasks";
import { db } from "@/lib/supabase/server";
import { canAssignTasks, canOnboard, canSeeBrands } from "@/lib/permissions";
import { OPEN_TASK, taskKindLabel } from "@/lib/constants";
import { fmtDay } from "@/lib/format";

export async function generateMetadata({ params }) {
  const { id } = await params;
  await requireMember(canSeeBrands);
  const b = await getBrand(id);
  return { title: b ? b.name : "Brand" };
}

const isOverdue = (t) => OPEN_TASK.includes(t.status) && t.due_at && new Date(t.due_at).getTime() < Date.now();
const isImg = (n) => /\.(jpe?g|png|webp|gif)$/i.test(n || "");
const isVid = (n) => /\.(mp4|mov|webm|m4v)$/i.test(n || "");

/** The final files of every approved task (latest revision), newest first. */
async function library(tasks) {
  const done = tasks.filter((t) => t.status === "done");
  if (!done.length) return [];
  const { data: files } = await db()
    .from("task_files")
    .select("id, task_id, revision, name, storage_path, url")
    .in("task_id", done.map((t) => t.id))
    .eq("role", "deliverable");
  const byTask = Object.fromEntries(done.map((t) => [t.id, t]));
  const final = (files || []).filter((f) => f.revision === byTask[f.task_id].revision);
  const paths = final.filter((f) => f.storage_path).map((f) => f.storage_path);
  let signed = {};
  if (paths.length) {
    const { data } = await db().storage.from("lead-docs").createSignedUrls(paths, 3600);
    signed = Object.fromEntries((data || []).filter((x) => x.signedUrl).map((x) => [x.path, x.signedUrl]));
  }
  return final
    .map((f) => ({ ...f, href: f.storage_path ? signed[f.storage_path] || "" : f.url, task: byTask[f.task_id] }))
    .sort((a, b) => new Date(b.task.done_at) - new Date(a.task.done_at));
}

export default async function BrandPage({ params, searchParams }) {
  const { id } = await params;
  const { tab } = await searchParams;
  const me = await requireMember(canSeeBrands);
  const brand = await getBrand(id);
  if (!brand) notFound();
  const [tasks, people] = await Promise.all([listTasks(me, { view: "all", brandId: id }), canAssignTasks(me) ? listMakers() : []]);
  const overdue = tasks.filter(isOverdue);
  const done = tasks.filter((t) => t.status === "done");
  const current = ["tasks", "chat", "library", "about"].includes(tab) ? tab : "tasks";
  const files = current === "library" ? await library(tasks) : [];
  const chat = current === "chat" ? await loadChat(id) : null;
  const unread = current === "chat" ? 0 : (await unreadCounts([id], me.id))[id] || 0;

  // Work by kind: how many posts / reels / … and how many approved
  const kinds = {};
  for (const t of tasks) {
    const k = (kinds[t.kind] ||= { total: 0, done: 0 });
    k.total += 1;
    if (t.status === "done") k.done += 1;
  }

  return (
    <div className="page max-w-6xl">
      <PageHeader back={{ href: "/brands", label: "Brands" }} />

      <section className="rise card relative -mt-2 overflow-hidden p-6 sm:p-8">
        <span className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full blur-3xl" style={{ background: "color-mix(in srgb, #8b93ff 22%, transparent)" }} />
        <div className="relative flex flex-wrap items-start justify-between gap-6">
          <div className="flex min-w-0 items-start gap-4">
            <Avatar name={brand.name} size={64} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                <span className="code">{brand.lead?.code}</span>
                {brand.onboarded_at ? <span>Client since {fmtDay(brand.onboarded_at)}</span> : <span>Onboarding</span>}
              </div>
              <h1 className="mt-2 text-[30px] font-medium leading-tight tracking-[-0.02em] md:text-[40px]">{brand.name}</h1>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {(brand.services || []).map((s) => (
                  <span key={s.name} className="rounded-full bg-panel-2 px-2.5 py-1 text-xs text-muted">
                    {s.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="w-full sm:w-64">
            <Progress done={done.length} total={tasks.length} />
          </div>
        </div>
      </section>

      <StatStrip
        className="rise rise-1 mt-5"
        items={[
          { label: "Tasks", value: tasks.length, icon: "tasks" },
          { label: "In work", value: tasks.filter((t) => OPEN_TASK.includes(t.status)).length, icon: "clock", tint: "amber" },
          { label: "With client", value: tasks.filter((t) => t.status === "sent_to_client").length, icon: "arrow", tint: "blue" },
          { label: "Overdue", value: overdue.length, icon: "alert", tint: "pink" },
        ]}
      />

      <div className="rise rise-2 mt-5 flex flex-wrap items-center justify-between gap-3">
        <nav className="seg flex p-1.5">
          {[
            ["tasks", "Tasks"],
            ["chat", unread ? `Chat · ${unread}` : "Chat"],
            ["library", "Library"],
            ["about", "Scope"],
          ].map(([k, l]) => (
            <Link key={k} href={`/brands/${id}?tab=${k}`} data-on={current === k} className="seg-item">
              {l}
            </Link>
          ))}
        </nav>
        {canOnboard(me) && (
          <Link href={`/leads/${brand.lead_id}#onboarding`} className="btn-ghost btn-sm">
            <Icon name="file" size={13} /> Lead & MOU
          </Link>
        )}
      </div>

      <div className="rise rise-3 mt-5 flex flex-col gap-5">
        {current === "tasks" && (
          <>
            {canAssignTasks(me) && brand.stage === "active" && (
              <div className="flex">
                <NewTaskForm brandId={id} people={people} />
              </div>
            )}
            {brand.stage !== "active" && <p className="well p-4 text-sm text-muted">Tasks open up once the MOU is signed.</p>}
            {overdue.length > 0 && (
              <Panel title="Overdue">
                <TaskList tasks={overdue} showBrand={false} />
              </Panel>
            )}
            <Panel title="Needs review" sub="Completed by the team, or changes the client asked for">
              <TaskList tasks={tasks.filter((t) => ["completed", "client_rejected"].includes(t.status))} showBrand={false} empty="Nothing to review." />
            </Panel>
            <div className="grid gap-5 lg:grid-cols-2">
              <Panel title="In work">
                <TaskList tasks={tasks.filter((t) => OPEN_TASK.includes(t.status) && !overdue.includes(t))} showBrand={false} empty="No open tasks." />
              </Panel>
              <Panel title="With the client">
                <TaskList tasks={tasks.filter((t) => t.status === "sent_to_client")} showBrand={false} empty="Nothing waiting on the client." />
              </Panel>
            </div>
            <Panel title="Approved" sub={`${done.length} done`}>
              <TaskList tasks={[...done].reverse()} showBrand={false} empty="Nothing approved yet." />
            </Panel>
          </>
        )}

        {current === "chat" && (
          <BrandChat
            brandId={id}
            brandName={brand.name}
            side="team"
            meId={me.id}
            meName={me.name}
            initial={{ messages: chat.messages, reads: chat.reads }}
            lastReadAt={chat.mine[me.id] || null}
            load={brandChat.bind(null, id)}
            send={sendBrandMessage.bind(null, id)}
            upload={brandChatUpload.bind(null, id)}
            markRead={markBrandRead.bind(null, id)}
            className="h-[calc(100svh-14rem)] min-h-[480px]"
          />
        )}

        {current === "library" && (
          <Panel title="Library" sub="Final versions of everything approved for this brand">
            {files.length ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {files.map((f) => (
                  <a key={f.id} href={f.href} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-2xl bg-panel-2">
                    {isImg(f.name) && f.href ? (
                      // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
                      <img src={f.href} alt={f.task.title} loading="lazy" className="aspect-square w-full object-cover transition duration-300 group-hover:scale-105" />
                    ) : isVid(f.name) && f.href ? (
                      <video src={f.href} className="aspect-square w-full bg-black object-cover" muted playsInline preload="metadata" />
                    ) : (
                      <div className="grid aspect-square place-items-center text-muted">
                        <Icon name={f.storage_path ? "file" : "link"} size={24} />
                      </div>
                    )}
                    <div className="px-3 py-2">
                      <div className="truncate text-xs font-medium">{f.task.title}</div>
                      <div className="text-[11px] text-muted">
                        {taskKindLabel(f.task.kind)} · {fmtDay(f.task.done_at)}
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <Empty icon="file">Approved posts, reels and videos collect here.</Empty>
            )}
          </Panel>
        )}

        {current === "about" && (
          <div className="grid gap-5 lg:grid-cols-2">
            <Panel title="Services (from the MOU)">
              <ul className="flex flex-col gap-2">
                {(brand.services || []).map((s) => (
                  <li key={s.name} className="well p-4">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-sm font-medium">{s.name}</span>
                      {canOnboard(me) && s.fee && (
                        <span className="shrink-0 text-xs text-muted">
                          {s.fee} · {s.billing}
                        </span>
                      )}
                    </div>
                    {s.scope && <p className="mt-1 text-xs text-muted">{s.scope}</p>}
                  </li>
                ))}
              </ul>
            </Panel>
            <Panel title="Work by type">
              {Object.keys(kinds).length ? (
                <ul className="flex flex-col gap-3">
                  {Object.entries(kinds).map(([k, v]) => (
                    <li key={k}>
                      <div className="flex justify-between text-sm">
                        <span>{taskKindLabel(k)}</span>
                        <span className="text-muted">
                          {v.done} / {v.total}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-panel-2">
                        <div className="bar-fill h-full rounded-full" style={{ width: `${Math.round((v.done / v.total) * 100)}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty icon="chart">No tasks yet.</Empty>
              )}
            </Panel>
          </div>
        )}
      </div>
    </div>
  );
}
