import Link from "next/link";
import { Avatar, Panel, StatCard } from "@/components/ui";
import { FilterPills, PageTop, Section, TaskLine } from "@/components/Desk";
import TaskBoard from "@/components/TaskBoard";
import QuickAssign from "@/components/QuickAssign";
import { listBrands } from "@/lib/brands";
import MyWork from "@/components/MyWork";
import { requireMember } from "@/lib/auth";
import { listMakers, listTasks } from "@/lib/tasks";
import { canAssignTasks, headsTeam, myTeam } from "@/lib/permissions";
import { OPEN_TASK, kindPlural, byPriority } from "@/lib/constants";

export const metadata = { title: "Tasks" };
const nowMs = () => Date.now();


const overdue = (t) => OPEN_TASK.includes(t.status) && t.due_at && new Date(t.due_at).getTime() < Date.now();
const KIND_LABEL = { design: "Designer", development: "Developer", video: "Video editor", performance: "Performance", social: "Social media", production: "Production", execution: "Execution head" };

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

  const [everything, everyone, brands] = await Promise.all([listTasks(me, { view: "all" }), listMakers(me), listBrands()]);
  // Heads of departments start on their own team's work; "Everyone" shows the whole agency
  const team = myTeam(me);
  const teamView = me.role !== "admin" && headsTeam(me) && team.length > 0;
  const whole = sp.who === "all" || !teamView;
  const all = whole ? everything : everything.filter((t) => team.includes(t.assignee_id) || t.assigned_by === me.id);
  // Who you can give work to (a head: own team + other heads) vs whose workload you're looking at
  const assignable = everyone;
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
  const shown = kind ? byBrand.filter((t) => t.kind === kind) : byBrand;
  const href = (o) => {
    const q = new URLSearchParams({ ...(current !== "list" && { view: current }), ...(brand && { brand }), ...(kind && { kind }), ...(sp.who === "all" && { who: "all" }), ...o });
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
  const doneShare = shown.length ? Math.round((approved.length / shown.length) * 100) : 0;
  const open = shown.filter((t) => t.status !== "done").length;

  return (
    <div className="page">
      <PageTop
        title="Tasks"
        sub={`${teamView && !whole ? `${(me.ledGroups || []).map((g) => g.name).join(", ")} · ` : ""}${open} open · ${late.length} late · ${doneShare}% approved`}
        right={
          <>
            {teamView && (
              <FilterPills
                items={[
                  { label: "My team", href: href({ who: "" }), on: !whole },
                  { label: "Everyone", href: href({ who: "all" }), on: whole },
                ]}
              />
            )}
            <FilterPills items={views.map((v) => ({ label: v.label, count: v.count, href: href({ view: v.id === "list" ? "" : v.id }), on: current === v.id }))} />
            <QuickAssign brands={active} people={assignable} defaultBrand={brand} label="New task" />
          </>
        }
      />

      {(current === "list" || current === "board") && (
        <>
          <div className="rise grid grid-cols-2 gap-3 xl:grid-cols-4">
            <StatCard coral label="To check" value={toCheck.length} note={toCheck.length ? "Finished, waiting for you" : "Nothing waiting"} />
            <StatCard label="Late" value={late.length} tone="#e11d48" note={late.length ? "Past the due date" : "Nothing late"} />
            <StatCard label="In progress" value={working.length} note={`${withClient.length} with clients`} />
            <StatCard label="Approved" value={approved.length} bar={doneShare} />
          </div>

          <div className="rise mt-4 flex flex-wrap items-center gap-2">
            <FilterPills
              items={[{ label: "All", count: byBrand.length, href: href({ kind: "" }), on: !kind }, ...kinds.map((k) => ({ label: kindPlural(k), count: byBrand.filter((t) => t.kind === k).length, href: href({ kind: k }), on: kind === k }))]}
            />
            {active.length > 1 && (
              <FilterPills className="ml-auto" items={[{ label: "All brands", href: href({ brand: "" }), on: !brand }, ...active.map((b) => ({ label: b.name, href: href({ brand: b.id }), on: brand === b.id }))]} />
            )}
          </div>
        </>
      )}

      <div className="rise mt-4">
        {current === "list" && (
          <div className="grid items-start gap-4 lg:grid-cols-2">
            <Section title="To check" count={toCheck.length} tone="#8b5cf6" empty="Nothing to check ✓">
              {toCheck.map((t) => (
                <TaskLine key={t.id} t={t} showBrand={!brand} />
              ))}
            </Section>
            <Section title="Late" count={late.length} tone="#e11d48" empty="Nothing late ✓">
              {late.map((t) => (
                <TaskLine key={t.id} t={t} showBrand={!brand} />
              ))}
            </Section>
            <Section title="In progress" count={working.length} tone="#f59e0b" empty="No open work">
              {working.map((t) => (
                <TaskLine key={t.id} t={t} showBrand={!brand} />
              ))}
            </Section>
            <Section title="With client & approved" count={withClient.length + approved.length} tone="#10b981" empty="Nothing yet">
              {[...withClient, ...approved.slice(0, 12)].map((t) => (
                <TaskLine key={t.id} t={t} showBrand={!brand} />
              ))}
            </Section>
          </div>
        )}
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
