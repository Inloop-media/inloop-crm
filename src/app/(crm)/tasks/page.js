import Link from "next/link";
import { Avatar, Panel } from "@/components/ui";
import TaskBoard from "@/components/TaskBoard";
import QuickAssign from "@/components/QuickAssign";
import { listBrands } from "@/lib/brands";
import MyWork from "@/components/MyWork";
import { requireMember } from "@/lib/auth";
import { listMakers, listTasks } from "@/lib/tasks";
import { canAssignTasks } from "@/lib/permissions";
import { OPEN_TASK } from "@/lib/constants";

export const metadata = { title: "Tasks" };


const overdue = (t) => OPEN_TASK.includes(t.status) && t.due_at && new Date(t.due_at).getTime() < Date.now();
const KIND_LABEL = { design: "Designer", development: "Developer", video: "Video editor", execution: "Execution head" };

function Workload({ people, tasks }) {
  const open = tasks.filter((t) => OPEN_TASK.includes(t.status));
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {people.map((p) => {
        const mine = open.filter((t) => t.assignee_id === p.id);
        const late = mine.filter(overdue).length;
        const done = tasks.filter((t) => t.assignee_id === p.id && t.status === "done").length;
        const revs = tasks.filter((t) => t.assignee_id === p.id).reduce((n, t) => n + t.revision, 0);
        return (
          <section key={p.id} className="card p-5">
            <div className="flex items-center gap-3">
              <Avatar name={p.name} size={40} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{p.name}</div>
                <div className="truncate text-xs text-muted">{p.kinds.map((k) => KIND_LABEL[k] || k).join(" · ")}</div>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${mine.length >= 6 ? "bg-rose-400/15 text-rose-400" : mine.length >= 3 ? "bg-amber-400/15 text-amber-400" : "bg-emerald-400/15 text-emerald-400"}`}>
                {mine.length} open
              </span>
            </div>
            <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
              {[
                ["Overdue", late, late ? "text-rose-400" : ""],
                ["Approved", done, ""],
                ["Revisions", revs, ""],
              ].map(([l, v, c]) => (
                <div key={l} className="well px-2 py-2.5">
                  <dd className={`text-lg font-medium ${c}`}>{v}</dd>
                  <dt className="text-[11px] text-muted">{l}</dt>
                </div>
              ))}
            </dl>
            {mine.length > 0 && (
              <ul className="mt-3 flex flex-col gap-1 text-xs text-muted">
                {mine.slice(0, 3).map((t) => (
                  <li key={t.id} className="truncate">
                    <Link href={`/tasks/${t.id}`} className="hover:text-ink">
                      · {t.title} <span className="text-faint">({t.brand?.name})</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

export default async function TasksPage({ searchParams }) {
  const me = await requireMember();
  const head = canAssignTasks(me);
  const sp = await searchParams;
  const { view } = sp;
  const mine = await listTasks(me, { view: "mine" });

  if (!head) {
    return (
      <div className="page max-w-5xl">
        <div className="rise">
          <MyWork me={me} tasks={mine} />
        </div>
      </div>
    );
  }

  const [all, people, brands] = await Promise.all([listTasks(me, { view: "all" }), listMakers(), listBrands()]);
  const active = brands.filter((b) => b.stage === "active").map((b) => ({ id: b.id, name: b.name }));
  const myOpen = mine.filter((t) => t.status !== "done").length;
  const tabs = [
    { id: "board", label: "Board" },
    { id: "team", label: "Team" },
    ...(mine.length ? [{ id: "mine", label: myOpen ? `My tasks · ${myOpen}` : "My tasks" }] : []),
  ];
  const current = tabs.find((t) => t.id === view)?.id || "board";
  const brand = active.find((b) => b.id === sp.brand)?.id || "";
  const shown = brand ? all.filter((t) => t.brand_id === brand) : all;

  return (
    <div className="page">
      <header className="rise mb-5 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-[30px] font-medium leading-tight tracking-[-0.02em] md:text-[36px]">Tasks</h1>
        <div className="flex flex-wrap items-center gap-2">
          <nav className="seg flex p-1">
            {tabs.map((t) => (
              <Link key={t.id} href={`/tasks?view=${t.id}`} data-on={current === t.id} className="seg-item text-xs">
                {t.label}
              </Link>
            ))}
          </nav>
          <QuickAssign brands={active} people={people} defaultBrand={brand} />
        </div>
      </header>

      <div className="rise rise-1">
        {current === "board" && (
          <>
            <p className="mb-3 text-sm text-muted">Drag a card to the next column when its stage changes. Click a card to open it.</p>
            {active.length > 1 && (
              <nav className="-mx-1 mb-4 flex gap-1.5 overflow-x-auto px-1 pb-1">
                <Link href="/tasks" className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${!brand ? "solid" : "bg-panel text-muted hover:text-ink"}`}>
                  All brands
                </Link>
                {active.map((b) => (
                  <Link key={b.id} href={`/tasks?brand=${b.id}`} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${brand === b.id ? "solid" : "bg-panel text-muted hover:text-ink"}`}>
                    {b.name}
                  </Link>
                ))}
              </nav>
            )}
            <TaskBoard tasks={shown} showBrand={!brand} />
          </>
        )}
        {current === "team" &&
          (people.length ? (
            <Workload people={people} tasks={all} />
          ) : (
            <Panel title="No team yet">
              <p className="text-sm text-muted">Add people to the Designers, Developers and Video Editors groups on the Team page — they show up here and in the task picker.</p>
            </Panel>
          ))}
        {current === "mine" && <MyWork me={me} tasks={mine} />}
      </div>
    </div>
  );
}
