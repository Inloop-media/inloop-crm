// Tasks (layout "B"): a title with one row of views, a short filter row (team / brand / type as
// dropdowns, not long pill rows), three numbers, then one list per stage. Empty stages hide.
import Link from "next/link";
import { Avatar, Panel } from "@/components/ui";
import { FilterPills, PageTop, Section } from "@/components/Desk";
import TaskBoard from "@/components/TaskBoard";
import TaskDesk from "@/components/TaskDesk";
import { filterHref, filterTasks } from "@/lib/taskFilters";
import QuickAssign from "@/components/QuickAssign";
import { listBrands } from "@/lib/brands";
import TeamToCheck from "@/components/TeamToCheck";
import TeamTasks from "@/components/TeamTasks";
import { requireMember } from "@/lib/auth";
import { leadAllTasks, listMakers, listTasks } from "@/lib/tasks";
import { canAssignTasks, headsTeam, leadTeam, myTeam } from "@/lib/permissions";
import { OPEN_TASK } from "@/lib/constants";

export const metadata = { title: "Tasks" };
/** The brands in a list of tasks, for the brand filter. */
const brandsOf = (tasks) => [...new Map(tasks.filter((t) => t.brand).map((t) => [t.brand.id, { id: t.brand.id, name: t.brand.name }])).values()].sort((a, b) => a.name.localeCompare(b.name));
const nowMs = () => Date.now();

const overdue = (t) => OPEN_TASK.includes(t.status) && t.due_at && new Date(t.due_at).getTime() < nowMs();
const KIND_LABEL = {
  design: "Designer",
  development: "Developer",
  video: "Video editor",
  performance: "Performance",
  social: "Social media",
  production: "Production",
  execution: "CBO",
  strategy: "Creative strategist",
  sales: "Sales",
  head: "Manager",
};

/** Everyone you look after, one row each: what they have open, what's late, what got approved. */
function Workload({ people, tasks, link }) {
  const open = tasks.filter((t) => OPEN_TASK.includes(t.status));
  const rows = people
    .map((p) => {
      const mine = open.filter((t) => t.assignee_id === p.id);
      return {
        ...p,
        mine,
        late: mine.filter(overdue).length,
        done: tasks.filter((t) => t.assignee_id === p.id && t.status === "done").length,
      };
    })
    .sort((a, b) => b.late - a.late || b.mine.length - a.mine.length || a.name.localeCompare(b.name));
  const max = Math.max(1, ...rows.map((r) => r.mine.length));
  return (
    <Section title="Team" count={rows.length}>
      {rows.map((p) => (
        <li key={p.id} className="flex items-center gap-3 border-b border-line py-3 last:border-0">
          <Avatar name={p.name} size={34} />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-3">
              <Link href={link(p.id)} className="truncate text-[14px] font-medium hover:underline">
                {p.name}
              </Link>
              <span className="shrink-0 text-[12px] tabular-nums text-muted">
                {p.mine.length} open
                {p.late ? <span className="text-rose-500"> · {p.late} late</span> : ""} · {p.done} approved
              </span>
            </div>
            <div className="mt-0.5 truncate text-[12px] text-muted">
              {p.mine.length
                ? p.mine.slice(0, 3).map((t, i) => (
                    <span key={t.id}>
                      {i > 0 && " · "}
                      <Link href={`/tasks/${t.id}`} className="hover:text-ink">
                        {t.title}
                      </Link>
                    </span>
                  ))
                : p.kinds.map((k) => KIND_LABEL[k] || k).join(" · ") || "No open work"}
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-panel-2">
              <span className={`block h-full rounded-full ${p.late ? "bg-rose-500" : "bg-ink/70"}`} style={{ width: `${(p.mine.length / max) * 100}%` }} />
            </div>
          </div>
        </li>
      ))}
    </Section>
  );
}

export default async function TasksPage({ searchParams }) {
  const me = await requireMember();
  const head = canAssignTasks(me);
  // Team leads (e.g. Ananya) get the same page, over their team's work and their own
  const lead = !head && leadTeam(me).length > 0;
  const sp = await searchParams;
  const { view } = sp;
  // Everything this page needs, asked for at the same time
  const [mine, everything, makers, brands] = await Promise.all([
    listTasks(me, { view: "mine" }),
    head ? listTasks(me, { view: "all" }) : lead ? leadAllTasks(me) : [],
    head || lead ? listMakers(me) : [],
    head || lead ? listBrands() : [],
  ]);
  const everyone = lead ? makers.filter((p) => [...leadTeam(me), me.id].includes(p.id)) : makers;

  if (!head && !lead) {
    return (
      <div className="page max-w-5xl">
        <PageTop title="My tasks" sub="Do now first. Press Start when you begin; when it's ready, open the task, upload the file and submit." />
        <div className="rise mb-5 flex flex-col gap-5">
          <TeamToCheck me={me} />
          <TeamTasks me={me} />
        </div>
        <TaskDesk me={me} sp={sp} base="/tasks" all={mine} active={brandsOf(mine)} member />
      </div>
    );
  }

  // Heads of departments start on their own team's work; "Everyone" shows the whole agency
  const team = myTeam(me);
  const teamView = !lead && me.role !== "admin" && headsTeam(me) && team.length > 0;
  const whole = sp.who === "all" || !teamView;
  const all = whole ? everything : everything.filter((t) => team.includes(t.assignee_id) || t.assigned_by === me.id);
  const people = whole ? everyone : everyone.filter((p) => team.includes(p.id) || p.id === me.id);
  const active = brands.filter((b) => b.stage === "active").map((b) => ({ id: b.id, name: b.name }));
  const myOpen = mine.filter((t) => t.status !== "done").length;
  const views = [{ id: "list", label: "List" }, { id: "board", label: "Board" }, { id: "team", label: "Team" }, ...(mine.length ? [{ id: "mine", label: "Mine", count: myOpen }] : [])];
  const current = views.find((t) => t.id === view)?.id || "list";
  const keep = {
    ...(current !== "list" && { view: current }),
    ...(sp.who === "all" && { who: "all" }),
  };
  const f = filterTasks({ all, sp, me, active, lead });
  const href = (o) => filterHref("/tasks", f, sp, keep, o);
  const showFilters = current === "list" || current === "board";

  return (
    <div className="page">
      <PageTop
        title="Tasks"
        sub={lead ? "Your team's work and yours" : teamView && !whole ? (me.ledGroups || []).map((g) => g.name).join(", ") : "Everyone's work"}
        right={
          <>
            <FilterPills
              items={views.map((v) => ({
                label: v.label,
                count: v.count,
                href: href({ view: v.id === "list" ? "" : v.id }),
                on: current === v.id,
              }))}
            />
            {head && <QuickAssign brands={active} people={everyone} defaultBrand={f.brand} label="New task" />}
          </>
        }
      />

      {showFilters && (
        <TaskDesk
          me={me}
          sp={sp}
          base="/tasks"
          all={all}
          active={active}
          head={head}
          lead={lead}
          keep={keep}
          showList={current === "list"}
          extra={
            teamView && (
              <FilterPills
                items={[
                  { label: "My team", href: href({ who: "" }), on: !whole },
                  { label: "Everyone", href: href({ who: "all" }), on: whole },
                ]}
              />
            )
          }
        />
      )}
      {current === "team" && teamView && (
        <div className="rise mb-5">
          <FilterPills
            items={[
              { label: "My team", href: href({ who: "" }), on: !whole },
              { label: "Everyone", href: href({ who: "all" }), on: whole },
            ]}
          />
        </div>
      )}

      <div className="rise">
        {current === "board" && <TaskBoard tasks={f.shown} showBrand={!f.brand} />}
        {current === "team" &&
          (people.length ? (
            <Workload people={people} tasks={all} link={(id) => href({ view: "", person: id })} />
          ) : (
            <Panel title="No team yet">
              <p className="text-sm text-muted">Add people to the Designers, Developers and Video Editors groups on the Team page — they show up here and in the task picker.</p>
            </Panel>
          ))}
        {current === "mine" && <TaskDesk me={me} sp={sp} base="/tasks" all={mine} active={brandsOf(mine)} member keep={{ view: "mine" }} />}
      </div>
    </div>
  );
}
