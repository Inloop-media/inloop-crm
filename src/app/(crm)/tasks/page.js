// Tasks (layout "B"): a title with one row of views, a short filter row (team / brand / type as
// dropdowns, not long pill rows), three numbers, then one list per stage. Empty stages hide.
import Link from "next/link";
import { Avatar, Panel } from "@/components/ui";
import { FilterPills, PageTop, Section, TaskLine } from "@/components/Desk";
import { Counts } from "@/components/Home";
import LinkSelect from "@/components/LinkSelect";
import TaskBoard from "@/components/TaskBoard";
import ShowMore from "@/components/ShowMore";
import TaskSearch from "@/components/TaskSearch";
import QuickAssign from "@/components/QuickAssign";
import { listBrands } from "@/lib/brands";
import MyWork from "@/components/MyWork";
import TeamToCheck from "@/components/TeamToCheck";
import TeamTasks from "@/components/TeamTasks";
import { requireMember } from "@/lib/auth";
import { leadAllTasks, listMakers, listTasks } from "@/lib/tasks";
import { canAssignTasks, headsTeam, leadTeam, myTeam } from "@/lib/permissions";
import { OPEN_TASK, kindPlural, byPriority, fromCalendar } from "@/lib/constants";

export const metadata = { title: "Tasks" };
const nowMs = () => Date.now();

const overdue = (t) => OPEN_TASK.includes(t.status) && t.due_at && new Date(t.due_at).getTime() < nowMs();
const KIND_LABEL = { design: "Designer", development: "Developer", video: "Video editor", performance: "Performance", social: "Social media", production: "Production", execution: "CBO", strategy: "Creative strategist", sales: "Sales", head: "Manager" };

/** Everyone you look after, one row each: what they have open, what's late, what got approved. */
function Workload({ people, tasks, link }) {
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
              <Link href={link(p.id)} className="truncate text-[14px] font-medium hover:underline">
                {p.name}
              </Link>
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
        <PageTop title="My tasks" sub="Press Start when you begin. When it's ready, open the task, upload the file and submit." />
        <div className="rise mb-5 flex flex-col gap-5">
          <TeamToCheck me={me} />
          <TeamTasks me={me} />
        </div>
        <div className="rise">
          <MyWork me={me} tasks={mine} />
        </div>
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
  // When it was given: today / yesterday / this week / this month (India time)
  const DAY = 864e5;
  const istDay = (ms) => new Date(ms).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const todayKey = istDay(nowMs());
  const WHEN = {
    today: (k) => k === todayKey,
    yesterday: (k) => k === istDay(nowMs() - DAY),
    week: (k) => k >= istDay(nowMs() - 6 * DAY),
    month: (k) => k >= istDay(nowMs() - 29 * DAY),
  };
  const when = WHEN[sp.when] ? sp.when : "";
  const byWhen = when ? byKind.filter((t) => t.created_at && WHEN[when](istDay(new Date(t.created_at).getTime()))) : byKind;
  // One person's work, or only what I gave out — so it's easy to remember who has what
  const given = sp.by === "me";
  const byGiver = given ? byWhen.filter((t) => t.assigned_by === me.id) : byWhen;
  const doers = [...new Map(byGiver.filter((t) => t.assignee).map((t) => [t.assignee_id, t.assignee.name])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const person = doers.some(([id]) => id === sp.person) ? sp.person : "";
  const byPerson = person ? byGiver.filter((t) => t.assignee_id === person) : byGiver;
  // Content-calendar work vs everything else
  const src = ["calendar", "other"].includes(sp.src) ? sp.src : "";
  const bySrc = src ? byPerson.filter((t) => (src === "calendar") === fromCalendar(t)) : byPerson;
  // Search: every word must match the task name, brand, person or type
  const q = String(sp.q || "").trim().toLowerCase().slice(0, 80);
  const words = q.split(/\s+/).filter(Boolean);
  const hay = (t) => [t.title, t.brand?.name, t.assignee?.name, t.kind].join(" ").toLowerCase();
  const shown = words.length ? bySrc.filter((t) => words.every((w) => hay(t).includes(w))) : bySrc;
  const href = (o) => {
    const qs = new URLSearchParams({ ...(current !== "list" && { view: current }), ...(brand && { brand }), ...(kind && { kind }), ...(src && { src }), ...(person && { person }), ...(given && { by: "me" }), ...(q && { q: sp.q }), ...(when && { when }), ...(sp.show && { show: sp.show }), ...(sp.who === "all" && { who: "all" }), ...o });
    for (const [k, v] of [...qs]) if (!v) qs.delete(k);
    const str = qs.toString();
    return str ? `/tasks?${str}` : "/tasks";
  };

  const now = nowMs();
  const isLate = (t) => OPEN_TASK.includes(t.status) && t.due_at && new Date(t.due_at).getTime() < now;
  const toCheck = (lead ? shown.filter((t) => t.with_lead && (t.lead_ids || []).includes(me.id)) : shown.filter((t) => ["completed", "client_rejected"].includes(t.status) && !t.with_lead)).sort(byPriority);
  // Finished, but the team lead (e.g. Ananya) checks it first
  // Heads: still with the team lead. Team leads: checked by them, now with the manager.
  const withLead = lead ? shown.filter((t) => ["completed", "client_rejected"].includes(t.status) && !t.with_lead) : shown.filter((t) => t.with_lead);
  const late = shown.filter(isLate).sort(byPriority);
  const working = shown.filter((t) => OPEN_TASK.includes(t.status) && !isLate(t)).sort(byPriority);
  const withClient = shown.filter((t) => t.status === "sent_to_client");
  const approved = shown.filter((t) => t.status === "done").sort((a, b) => (b.done_at || "").localeCompare(a.done_at || ""));
  const lists = [
    { key: "check", title: "To check", list: toCheck, empty: "Nothing waiting for your check." },
    { key: "late", title: "Late", list: late, empty: "Nothing late." },
    { key: "progress", title: "In progress", list: working, empty: "Nothing in progress." },
    { key: "lead", title: lead ? "With manager" : "With team lead", list: withLead, empty: lead ? "Nothing waiting on the manager." : "Nothing with the team leads." },
    { key: "ready", title: "Ready for client", list: shown.filter((t) => t.status === "ready"), optional: true },
    { key: "hold", title: "On hold", list: shown.filter((t) => t.status === "on_hold"), optional: true },
    { key: "client", title: "With client", list: withClient, optional: true },
    { key: "done", title: "Completed", list: approved, empty: "Nothing completed yet." },
  ].filter((l) => !l.optional || l.list.length);
  // Opens on the first list that has something (To check → Late → In progress …) unless one was picked
  const firstKey = (lists.find((l) => l.list.length) || lists[0]).key;
  const pick = lists.find((l) => l.key === sp.show) || lists.find((l) => l.key === firstKey);
  const filtered = Boolean(brand || kind || src || person || given || q || when);
  const showFilters = current === "list" || current === "board";

  return (
    <div className="page">
      <PageTop
        title="Tasks"
        sub={lead ? "Your team's work and yours" : teamView && !whole ? (me.ledGroups || []).map((g) => g.name).join(", ") : "Everyone's work"}
        right={
          <>
            <FilterPills items={views.map((v) => ({ label: v.label, count: v.count, href: href({ view: v.id === "list" ? "" : v.id }), on: current === v.id }))} />
            {head && <QuickAssign brands={active} people={everyone} defaultBrand={brand} label="New task" />}
          </>
        }
      />

      {(showFilters || (current === "team" && teamView)) && (
        <div className="rise mb-5 flex flex-wrap items-center gap-2">
          {showFilters && <TaskSearch />}
          {showFilters && (
            <FilterPills
              items={[
                { label: "All work", count: byPerson.length, href: href({ src: "" }), on: !src },
                { label: "Content calendar", count: byPerson.filter(fromCalendar).length, href: href({ src: "calendar" }), on: src === "calendar" },
                { label: "Other tasks", count: byPerson.filter((t) => !fromCalendar(t)).length, href: href({ src: "other" }), on: src === "other" },
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
          {showFilters && head && (
            <FilterPills
              items={[
                { label: "Everyone's tasks", href: href({ by: "", person: "" }), on: !given },
                { label: "Given by me", count: byKind.filter((t) => t.assigned_by === me.id).length, href: href({ by: "me", person: "" }), on: given },
              ]}
            />
          )}
          {showFilters && doers.length > 1 && (
            <LinkSelect label="Person" value={person} options={[{ value: "", label: "All people", href: href({ person: "" }) }, ...doers.map(([id, name]) => ({ value: id, label: `${name} · ${byGiver.filter((t) => t.assignee_id === id && t.status !== "done").length} open`, href: href({ person: id }) }))]} />
          )}
          {showFilters && active.length > 1 && (
            <LinkSelect label="Brand" value={brand} options={[{ value: "", label: "All brands", href: href({ brand: "", kind: "" }) }, ...active.map((b) => ({ value: b.id, label: b.name, href: href({ brand: b.id, kind: "" }) }))]} />
          )}
          {showFilters && kinds.length > 1 && (
            <LinkSelect label="Type" value={kind} options={[{ value: "", label: "All types", href: href({ kind: "" }) }, ...kinds.map((k) => ({ value: k, label: kindPlural(k), href: href({ kind: k }) }))]} />
          )}
          {showFilters && (
            <LinkSelect
              label="Assigned"
              value={when}
              options={[
                { value: "", label: "Assigned any time", href: href({ when: "" }) },
                { value: "today", label: "Assigned today", href: href({ when: "today" }) },
                { value: "yesterday", label: "Assigned yesterday", href: href({ when: "yesterday" }) },
                { value: "week", label: "Assigned this week", href: href({ when: "week" }) },
                { value: "month", label: "Assigned this month", href: href({ when: "month" }) },
              ]}
            />
          )}
          {showFilters && filtered && (
            <Link href={href({ brand: "", kind: "", src: "", person: "", by: "", q: "", when: "" })} className="px-2 text-[12.5px] text-muted hover:text-ink">
              Clear
            </Link>
          )}
        </div>
      )}

      {showFilters && (
        <Counts
          items={(current === "list" ? lists : lists.slice(0, 3)).map((l) => ({
            label: l.title,
            value: l.list.length,
            tone: ["check", "late"].includes(l.key) ? "red" : "",
            // Each card is a tab: it shows that one list below (on the board view it opens the list)
            href: href({ view: "", show: l.key === firstKey ? "" : l.key }),
            active: current === "list" ? l.key === pick.key : undefined,
          }))}
        />
      )}

      <div className="rise">
        {current === "list" &&
          (shown.length ? (
            <Section title={pick.title} count={pick.list.length} empty={pick.empty}>
              <ShowMore limit={q ? 200 : 25}>
                {pick.list.map((t) => (
                  <TaskLine key={t.id} t={t} showBrand={!brand} showAssignee={!person} />
                ))}
              </ShowMore>
            </Section>
          ) : (
            <p className="card p-6 text-[13px] text-muted">{q ? `No task matches "${sp.q}".` : filtered ? "No tasks match these filters." : "No tasks yet. Press New task to give someone work."}</p>
          ))}
        {current === "board" && <TaskBoard tasks={shown} showBrand={!brand} />}
        {current === "team" &&
          (people.length ? (
            <Workload people={people} tasks={all} link={(id) => href({ view: "", person: id })} />
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
