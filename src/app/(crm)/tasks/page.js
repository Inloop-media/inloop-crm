import Link from "next/link";
import { Avatar, PageHeader, Panel, StatStrip } from "@/components/ui";
import { TaskList } from "@/components/Tasks";
import TaskOverview from "@/components/TaskOverview";
import { requireMember } from "@/lib/auth";
import { listMakers, listTasks } from "@/lib/tasks";
import { canAssignTasks } from "@/lib/permissions";
import { OPEN_TASK } from "@/lib/constants";

export const metadata = { title: "Tasks" };

const keep = (sp, view) => ({ view, ...Object.fromEntries(["brand", "bsort", "tsort", "show"].filter((k) => typeof sp?.[k] === "string").map((k) => [k, sp[k]])) });

const overdue = (t) => OPEN_TASK.includes(t.status) && t.due_at && new Date(t.due_at).getTime() < Date.now();
const KIND_LABEL = { design: "Designer", development: "Developer", video: "Video editor", execution: "Execution head" };

function MyTasks({ tasks }) {
  const attention = tasks.filter((t) => t.status === "revision" || overdue(t));
  const todo = tasks.filter((t) => t.status === "assigned" && !overdue(t));
  const doing = tasks.filter((t) => t.status === "in_progress" && !overdue(t));
  const waiting = tasks.filter((t) => ["completed", "sent_to_client", "client_rejected"].includes(t.status));
  const done = tasks.filter((t) => t.status === "done").slice(-15).reverse();
  return (
    <div className="flex flex-col gap-5">
      {attention.length > 0 && (
        <Panel title="Needs attention" sub="Revisions and anything past its due date">
          <TaskList tasks={attention} showAssignee={false} />
        </Panel>
      )}
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="To do" sub={`${todo.length} task${todo.length === 1 ? "" : "s"}`}>
          <TaskList tasks={todo} showAssignee={false} empty="Nothing new." />
        </Panel>
        <Panel title="In progress">
          <TaskList tasks={doing} showAssignee={false} empty="Pick a task and set it to In progress." />
        </Panel>
      </div>
      <Panel title="In review" sub="With your head or the client">
        <TaskList tasks={waiting} showAssignee={false} empty="Nothing waiting." />
      </Panel>
      {done.length > 0 && (
        <Panel title="Recently approved">
          <TaskList tasks={done} showAssignee={false} />
        </Panel>
      )}
    </div>
  );
}

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
    const open = mine.filter((t) => OPEN_TASK.includes(t.status));
    return (
      <div className="page">
        <PageHeader kicker="Your work" title="My tasks">
          <StatStrip
            className="mt-5"
            items={[
              { label: "Open", value: open.length, icon: "tasks" },
              { label: "Overdue", value: open.filter(overdue).length, icon: "clock", tint: "pink" },
              { label: "Revisions", value: mine.filter((t) => t.status === "revision").length, icon: "refresh", tint: "amber" },
              { label: "Approved", value: mine.filter((t) => t.status === "done").length, icon: "check", tint: "green" },
            ]}
          />
        </PageHeader>
        <div className="rise rise-2">
          <MyTasks tasks={mine} />
        </div>
      </div>
    );
  }

  const [all, people] = await Promise.all([listTasks(me, { view: "all" }), listMakers()]);
  const byMe = all.filter((t) => t.assigned_by === me.id);
  const review = all.filter((t) => ["completed", "client_rejected"].includes(t.status));
  const tabs = [
    { id: "review", label: "To review", count: review.length },
    { id: "assigned", label: "Assigned by me", count: byMe.filter((t) => t.status !== "done").length },
    { id: "brands", label: "By brand", count: new Set(all.map((t) => t.brand_id)).size },
    { id: "open", label: "All open", count: all.filter((t) => t.status !== "done").length },
    { id: "team", label: "Team", count: people.length },
    { id: "mine", label: "Assigned to me", count: mine.filter((t) => t.status !== "done").length },
  ];
  const current = tabs.find((t) => t.id === view)?.id || "review";

  return (
    <div className="page">
      <PageHeader kicker="Execution" title="Tasks">
        <StatStrip
          className="mt-5"
          items={[
            { label: "Open", value: all.filter((t) => OPEN_TASK.includes(t.status)).length, icon: "tasks" },
            { label: "To review", value: review.length, icon: "check", tint: "lavender" },
            { label: "With clients", value: all.filter((t) => t.status === "sent_to_client").length, icon: "arrow", tint: "blue" },
            { label: "Overdue", value: all.filter(overdue).length, icon: "clock", tint: "pink" },
          ]}
        />
      </PageHeader>

      <nav className="seg rise rise-1 mb-5 flex w-full overflow-x-auto p-1.5 sm:w-fit">
        {tabs.map((t) => (
          <Link key={t.id} href={`/tasks?view=${t.id}`} data-on={current === t.id} className="seg-item flex flex-1 items-center justify-center gap-2 whitespace-nowrap sm:flex-none">
            {t.label}
            <span className="rounded-full bg-panel-2 px-1.5 text-[11px] tabular-nums text-muted">{t.count}</span>
          </Link>
        ))}
      </nav>

      <div className="rise rise-2">
        {current === "review" && (
          <Panel title="Waiting for you" sub="Completed work to check, and client changes to reassign">
            <TaskList tasks={review} empty="All caught up." />
          </Panel>
        )}
        {current === "open" && (
          <div className="flex flex-col gap-5">
            <Panel title="Overdue">
              <TaskList tasks={all.filter(overdue)} empty="Nothing overdue." />
            </Panel>
            <Panel title="In the works">
              <TaskList tasks={all.filter((t) => OPEN_TASK.includes(t.status) && !overdue(t))} empty="No open tasks." />
            </Panel>
            <Panel title="With clients">
              <TaskList tasks={all.filter((t) => t.status === "sent_to_client")} empty="Nothing with clients." />
            </Panel>
          </div>
        )}
        {current === "team" &&
          (people.length ? (
            <Workload people={people} tasks={all} />
          ) : (
            <Panel title="No team yet">
              <p className="text-sm text-muted">Add people to the Designers, Developers and Video Editors groups on the Team page — they show up here and in the task picker.</p>
            </Panel>
          ))}
        {current === "mine" && <MyTasks tasks={mine} />}
        {current === "assigned" && <TaskOverview tasks={byMe} base="/tasks" params={keep(sp, "assigned")} showAssigners={false} sub="Work you assigned, brand by brand · tap one to see its tasks" />}
        {current === "brands" && <TaskOverview tasks={all} base="/tasks" params={keep(sp, "brands")} />}
      </div>
    </div>
  );
}
