import Link from "next/link";
import { notFound } from "next/navigation";
import Icon from "@/components/Icon";
import { BrandMark, Empty, Panel } from "@/components/ui";
import TaskBoard from "@/components/TaskBoard";
import QuickAssign from "@/components/QuickAssign";
import ContentCalendar from "@/components/ContentCalendar";
import { loadItems, loadPlans, monthLabel, planProgress, shiftMonth, validMonth } from "@/lib/calendar";
import BrandChat from "@/components/BrandChat";
import { brandChat, brandChatUpload, markBrandRead, sendBrandMessage } from "../actions";
import { chatMembers, loadChat, unreadCounts } from "@/lib/chat";
import { requireMember } from "@/lib/auth";
import { getBrand } from "@/lib/brands";
import { listMakers, listTasks } from "@/lib/tasks";
import { db } from "@/lib/supabase/server";
import { canAssignTasks, canEditCalendar, canOnboard, canSeeBrands, canSetPlan } from "@/lib/permissions";
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

const TABS = [
  ["tasks", "Tasks", "tasks"],
  ["calendar", "Calendar", "calendar"],
  ["chat", "Chat", "chat"],
  ["files", "Files", "file"],
  ["about", "About", "brief"],
];

export default async function BrandPage({ params, searchParams }) {
  const { id } = await params;
  const sp = await searchParams;
  const me = await requireMember(canSeeBrands);
  const brand = await getBrand(id);
  if (!brand) notFound();
  const current = TABS.some(([k]) => k === sp.tab) ? sp.tab : sp.tab === "library" ? "files" : "tasks";
  const month = validMonth(sp.month);
  const [tasks, people] = await Promise.all([listTasks(me, { view: "all", brandId: id }), canAssignTasks(me) ? listMakers(me) : []]);
  const overdue = tasks.filter(isOverdue);
  const done = tasks.filter((t) => t.status === "done");
  const files = current === "files" ? await library(tasks) : [];
  const [chat, members] = current === "chat" ? await Promise.all([loadChat(id), chatMembers()]) : [null, []];
  const unread = current === "chat" ? 0 : (await unreadCounts([id], me.id))[id] || 0;
  const [items, plans] = current === "calendar" ? await Promise.all([loadItems([id], month), loadPlans([id], month)]) : [[], {}];
  const active = brand.stage === "active";
  const tabHref = (k) => `/brands/${id}${k === "tasks" ? "" : `?tab=${k}`}`;

  // Work by kind: how many posts / reels / … and how many approved
  const kinds = {};
  for (const t of tasks) {
    const k = (kinds[t.kind] ||= { total: 0, done: 0 });
    k.total += 1;
    if (t.status === "done") k.done += 1;
  }

  return (
    <div className="flex min-h-svh flex-col">
      {/* Workspace header */}
      <header className="sticky top-0 z-20 border-b border-line bg-bg/80 px-4 pt-5 backdrop-blur-xl md:px-8">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <BrandMark name={brand.name} size={40} />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[22px] font-medium leading-tight tracking-[-0.015em] md:text-[26px]">{brand.name}</h1>
            <p className="truncate text-xs text-muted">
              {active ? `Client since ${fmtDay(brand.onboarded_at)}` : "Onboarding — MOU not signed yet"}
              {tasks.length > 0 && ` · ${tasks.length - done.length} tasks in progress · ${done.length} approved`}
              {overdue.length > 0 && <span className="text-rose-400"> · {overdue.length} late</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/library/${id}`} className="btn-ghost btn-sm">
              <Icon name="board" size={13} /> Library
            </Link>
            {canOnboard(me) && (
              <Link href={`/leads/${brand.lead_id}#onboarding`} className="btn-ghost btn-sm">
                <Icon name="file" size={13} /> Lead & MOU
              </Link>
            )}
            {canAssignTasks(me) && active && <QuickAssign brands={[{ id, name: brand.name }]} people={people} defaultBrand={id} label="New task" />}
          </div>
        </div>
        <nav className="-mb-px mt-4 flex gap-1 overflow-x-auto">
          {TABS.map(([k, l, icon]) => (
            <Link key={k} href={tabHref(k)} className={`relative flex shrink-0 items-center gap-2 px-3 pb-3 pt-1 text-sm transition ${current === k ? "font-medium text-ink" : "text-muted hover:text-ink"}`}>
              <Icon name={icon} size={14} />
              {l}
              {k === "chat" && unread > 0 && <span className="rounded-full bg-brand px-1.5 text-[10px] font-semibold leading-4 text-on-brand">{unread}</span>}
              {k === "tasks" && tasks.length - done.length > 0 && <span className="rounded-full bg-panel-2 px-1.5 text-[10px] leading-4 text-muted">{tasks.length - done.length}</span>}
              {current === k && <span className="absolute inset-x-2 bottom-0 h-[2px] rounded-full bg-brand" />}
            </Link>
          ))}
        </nav>
      </header>

      <div className="rise flex-1 px-4 py-6 md:px-8">
        {current === "tasks" &&
          (active ? (
            tasks.length ? (
              <TaskBoard tasks={tasks} showBrand={false} />
            ) : (
              <div className="card">
                <Empty icon="tasks">No tasks for {brand.name} yet. {canAssignTasks(me) ? "Use New task, or assign posts from the Calendar tab." : ""}</Empty>
              </div>
            )
          ) : (
            <p className="well p-5 text-sm text-muted">Tasks open up once the MOU is signed.</p>
          ))}

        {current === "calendar" && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-end gap-1">
              <Link href={`/brands/${id}?tab=calendar&month=${shiftMonth(month, -1)}`} className="icon-btn !h-9 !w-9" aria-label="Previous month">
                <Icon name="chevron" size={14} className="rotate-90" />
              </Link>
              <span className="min-w-[9.5rem] text-center text-sm font-medium">{monthLabel(month)}</span>
              <Link href={`/brands/${id}?tab=calendar&month=${shiftMonth(month, 1)}`} className="icon-btn !h-9 !w-9" aria-label="Next month">
                <Icon name="chevron" size={14} className="-rotate-90" />
              </Link>
            </div>
            <ContentCalendar
              brand={{ id, name: brand.name }}
              month={month}
              monthName={monthLabel(month)}
              items={items}
              plan={plans[id] || null}
              progress={planProgress(plans[id], items)}
              people={people}
              canEdit={canEditCalendar(me)}
              canAssign={canAssignTasks(me)}
              canPlan={canSetPlan(me)}
            />
          </div>
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
            className="h-[calc(100svh-15rem)] min-h-[480px]"
            members={members}
          />
        )}

        {current === "files" &&
          (files.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
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
            <div className="card">
              <Empty icon="file">Final files of every approved post, reel and video collect here.</Empty>
            </div>
          ))}

        {current === "about" && (
          <div className="grid gap-5 lg:grid-cols-2">
            <Panel title="Services (from the MOU)">
              {(brand.services || []).length ? (
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
              ) : (
                <Empty icon="brief">No services recorded.</Empty>
              )}
            </Panel>
            <Panel title="Work so far">
              {Object.keys(kinds).length ? (
                <ul className="flex flex-col gap-3">
                  {Object.entries(kinds).map(([k, v]) => (
                    <li key={k}>
                      <div className="flex justify-between text-sm">
                        <span>{taskKindLabel(k)}</span>
                        <span className="text-muted">
                          {v.done} / {v.total} approved
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
