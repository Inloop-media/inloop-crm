// Tasks (layout "B"): a title with one row of views, a short filter row (team / brand / type as
// dropdowns, not long pill rows), three numbers, then one list per stage. Empty stages hide.
import Link from "next/link";
import { Avatar, Panel } from "@/components/ui";
import { FilterPills, PageTop, Section, TaskLine } from "@/components/Desk";
import { Counts } from "@/components/Home";
import LinkSelect from "@/components/LinkSelect";
import TaskBoard from "@/components/TaskBoard";
import QuickAssign from "@/components/QuickAssign";
import { listBrands } from "@/lib/brands";
import MyWork from "@/components/MyWork";
import { requireMember } from "@/lib/auth";
import { listMakers, listTasks } from "@/lib/tasks";
import { canAssignTasks, headsTeam, myTeam } from "@/lib/permissions";
import { OPEN_TASK, kindPlural, byPriority, fromCalendar } from "@/lib/constants";

export const metadata = { title: "Tasks" };
const nowMs = () => Date.now();

const overdue = (t) => OPEN_TASK.includes(t.status) && t.due_at && new Date(t.due_at).getTime() < nowMs();
const KIND_LABEL = { design: "Designer", development: "Developer", video: "Video editor", performance: "Performance", social: "Social media", production: "Production", execution: "CBO", strategy: "Creative strategist", sales: "Sales", head: "Manager" };

/** Everyone you look after, one row each: what they have open, what's late, what got approved. */
function Workload({ people, tasks }) {
  const open = tasks.filter((t) => OPEN_TASK.includes(t.status));
  const rows = people
    .map((p) => {
      const mine = open.filter((t) => t.assignee_id === p.id);
      return { ...p, mine, late: mine.filter(overdue).length, done: tasks.filter((t) => t.assignee_id === p.id && t.status === "done").length };
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
              <span className="truncate text-[14px] font-medium">{p.name}</span>
              <span className="shrink-0 text-[12px] tabular-nums text-muted">
                {p.mine.length} open{p.late ? <span className="text-rose-500"> · {p.late} late</span> : ""} · {p.done} approved
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
  const sp = await searchParams;
  const { view } = sp;
  const mine = await listTasks(me, { view: "mine" });

  if (!head) {
    return (
      <div className="page max-w-5xl">
        <PageTop title="My tasks" sub="Press Start when you begin. When it's ready, open the task, upload the file and submit." />
        <div className="rise">
          <MyWork me={me} tasks={mine} />
        </div>
      </div>
    );
  }

  const [everything, everyone, brands] = await Promise.all([listTasks(me, { view: "all" }), listMakers(me), listBrands()]);
  // Heads of departments start on their own team's work; "Everyone" shows the whole agency
  const team = myTeam(me);
  const teamView = me.role !== "admin" && headsTeam(me) && team.length > 0;
  const whole = sp.who === "all" || !teamView;
  const all = whole ? everything : everything.filter((t) => team.includes(t.assignee_id) || t.assigned_by === me.id);
  const people = whole ? everyone : everyone.filter((p) => team.includes(p.id) || p.id === me.id);
  const active = brands.filter((b) => b.stage === "active").map((b) => ({ id: b.id, name: b.name }));
  const myOpen = mine.filter((t) => t.status !== "done").length;
  const views = [
    { id: "list", label: "List" },
    { id: "board", label: "Board" },
    { id: "team", label: "Team" },
    ...(mine.length ? [{ id: "mine", label: "Mine", count: myOpen }] : []),
  ];
  const current = views.find((t) => t.id === view)?.id || "list";
  const brand = active.find((b) => b.id === sp.brand)?.id || "";
  const byBrand = brand ? all.filter((t) => t.brand_id === brand) : all;
  const kinds = [...new Set(byBrand.map((t) => t.kind))];
  const kind = kinds.includes(sp.kind) ? sp.kind : "";
  const byKind = kind ? byBrand.filter((t) => t.kind === kind) : byBrand;
  // Content-calendar work vs everything else
  const src = ["calendar", "other"].includes(sp.src) ? sp.src : "";
  const shown = src ? byKind.filter((t) => (src === "calendar") === fromCalendar(t)) : byKind;
  const href = (o) => {
    const q = new URLSearchParams({ ...(current !== "list" && { view: current }), ...(brand && { brand }), ...(kind && { kind }), ...(src && { src }), ...(sp.who === "all" && { who: "all" }), ...o });
    for (const [k, v] of [...q]) if (!v) q.delete(k);
    const str = q.toString();
    return str ? `/tasks?${str}` : "/tasks";
  };

  const now = nowMs();
  const isLate = (t) => OPEN_TASK.includes(t.status) && t.due_at && new Date(t.due_at).getTime() < now;
  const toCheck = shown.filter((t) => ["completed", "client_rejected"].includes(t.status)).sort(byPriority);
  const late = shown.filter(isLate).sort(byPriority);
  const working = shown.filter((t) => OPEN_TASK.includes(t.status) && !isLate(t)).sort(byPriority);
  const withClient = shown.filter((t) => t.status === "sent_to_client");
  const approved = shown.filter((t) => t.status === "done").sort((a, b) => (b.done_at || "").localeCompare(a.done_at || ""));
  const filtered = Boolean(brand || kind || src);
  const showFilters = current === "list" || current === "board";

  return (
    <div className="page">
      <PageTop
        title="Tasks"
        sub={teamView && !whole ? (me.ledGroups || []).map((g) => g.name).join(", ") : "Everyone's work"}
        right={
          <>
            <FilterPills items={views.map((v) => ({ label: v.label, count: v.count, href: href({ view: v.id === "list" ? "" : v.id }), on: current === v.id }))} />
            <QuickAssign brands={active} people={everyone} defaultBrand={brand} label="New task" />
          </>
        }
      />

      {(showFilters || (current === "team" && teamView)) && (
        <div className="rise mb-5 flex flex-wrap items-center gap-2">
          {showFilters && (
            <FilterPills
              items={[
                { label: "All work", count: byKind.length, href: href({ src: "" }), on: !src },
                { label: "Content calendar", count: byKind.filter(fromCalendar).length, href: href({ src: "calendar" }), on: src === "calendar" },
                { label: "Other tasks", count: byKind.filter((t) => !fromCalendar(t)).length, href: href({ src: "other" }), on: src === "other" },
              ]}
            />
          )}
          {teamView && (
            <FilterPills
              items={[
                { label: "My team", href: href({ who: "" }), on: !whole },
                { label: "Everyone", href: href({ who: "all" }), on: whole },
              ]}
            />
          )}
          {showFilters && active.length > 1 && (
            <LinkSelect label="Brand" value={brand} options={[{ value: "", label: "All brands", href: href({ brand: "", kind: "" }) }, ...active.map((b) => ({ value: b.id, label: b.name, href: href({ brand: b.id, kind: "" }) }))]} />
          )}
          {showFilters && kinds.length > 1 && (
            <LinkSelect label="Type" value={kind} options={[{ value: "", label: "All types", href: href({ kind: "" }) }, ...kinds.map((k) => ({ value: k, label: kindPlural(k), href: href({ kind: k }) }))]} />
          )}
          {showFilters && filtered && (
            <Link href={href({ brand: "", kind: "", src: "" })} className="px-2 text-[12.5px] text-muted hover:text-ink">
              Clear
            </Link>
          )}
        </div>
      )}

      {showFilters && (
        <Counts
          items={[
            { label: "To check", value: toCheck.length, tone: "red" },
            { label: "Late", value: late.length, tone: "red" },
            { label: "In progress", value: working.length },
          ]}
        />
      )}

      <div className="rise">
        {current === "list" &&
          (shown.length ? (
            <div className="grid items-start gap-5 lg:grid-cols-2">
              {[
                ["To check", toCheck],
                ["Late", late],
                ["In progress", working],
                ["With the client", withClient],
                ["Approved", approved.slice(0, 12)],
              ]
                .filter(([, list]) => list.length)
                .map(([title, list]) => (
                  <Section key={title} title={title} count={title === "Approved" ? approved.length : list.length}>
                    {list.map((t) => (
                      <TaskLine key={t.id} t={t} showBrand={!brand} />
                    ))}
                  </Section>
                ))}
            </div>
          ) : (
            <p className="card p-6 text-[13px] text-muted">{filtered ? "No tasks match these filters." : "No tasks yet. Press New task to give someone work."}</p>
          ))}
        {current === "board" && <TaskBoard tasks={shown} showBrand={!brand} />}
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
