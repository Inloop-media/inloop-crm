// Home for everyone who isn't admin / ops / an execution head. Same look as the admin home, but every
// section is about this person's own work, and only the parts of the job they actually do show up:
//   maker (designer / editor / developer) → their tasks
//   sales executive with leads            → their pipeline and follow-ups
//   strategist with briefs                → their proposals and open briefs
// The hero and the red card follow their main job (tasks first, then leads, then briefs).
import Link from "next/link";
import Icon from "@/components/Icon";
import MyWork from "@/components/MyWork";
import { RoundLink, Ring } from "@/components/AdminHome";
import { Activity, MeetingAgenda, ProposalProgress } from "@/components/DashboardView";
import { Empty } from "@/components/ui";
import { CLOSED_STATUSES, OPEN_TASK } from "@/lib/constants";
import { ago, fullName } from "@/lib/format";
import { isMaker, isSales, isStrategist } from "@/lib/permissions";

const DAY = 864e5;
const IST = "Asia/Kolkata";
const brandOf = (l) => l.brand || fullName(l);
const dayKey = (d) => new Date(d).toLocaleDateString("en-CA", { timeZone: IST });
const time = new Intl.DateTimeFormat("en-IN", { timeZone: IST, hour: "numeric", minute: "2-digit" });
const dateLine = new Intl.DateTimeFormat("en-IN", { timeZone: IST, weekday: "long", day: "numeric", month: "long" });
function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-IN", { timeZone: IST, hour: "numeric", hour12: false }).format(new Date()));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function Card({ className = "", children }) {
  return <section className={`card min-w-0 p-5 ${className}`}>{children}</section>;
}
function Title({ title, sub, action }) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div>
        <h2 className="text-xl font-normal tracking-[-0.01em]">{title}</h2>
        {sub && <p className="text-xs text-muted">{sub}</p>}
      </div>
      {action}
    </div>
  );
}
function Tile({ icon, label, value, note, href }) {
  return (
    <Link href={href} className="flex items-center gap-3 rounded-2xl bg-panel-2 p-3 transition hover:bg-panel-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-panel text-brand shadow-[var(--card-shadow)]">
        <Icon name={icon} size={15} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[11px] text-muted">{label}</span>
        <span className="block text-lg font-medium leading-tight tabular-nums">{value}</span>
        <span className="block truncate text-[11px] text-muted">{note}</span>
      </span>
    </Link>
  );
}
function Bar({ pct, label }) {
  return (
    <>
      <div className="mt-6 flex h-3 gap-1">
        <span className="rounded-full bg-gradient-to-r from-brand-soft to-brand" style={{ width: `${Math.max(3, Math.min(100, pct))}%` }} />
        <span className="hatch flex-1 rounded-full" />
      </div>
      <p className="mt-2 text-[11px] text-muted">{label}</p>
    </>
  );
}
function RedCard({ title, value, unit, note, href, items }) {
  return (
    <section className="card-coral rise flex flex-col p-5">
      <div className="flex items-start justify-between">
        <h2 className="text-xl font-normal tracking-[-0.01em]">{title}</h2>
        <RoundLink href={href} label={title} light />
      </div>
      <div className="mt-5 flex items-end gap-2">
        <span className="text-[64px] font-light leading-none tabular-nums">{value}</span>
        <span className="mb-2 text-xs leading-tight text-white/80">{unit}</span>
      </div>
      <p className="mt-1 text-[11px] text-white/75">{note}</p>
      <ul className="mt-auto flex flex-col gap-1.5 pt-4 text-[12px]">
        {items.slice(0, 3).map(([id, label, to]) => (
          <li key={id}>
            <Link href={to} className="flex items-center justify-between rounded-lg bg-white/15 px-2.5 py-1.5 hover:bg-white/25">
              <span className="truncate">{label}</span>
              <Icon name="arrow" size={12} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PipelineCard({ stages, top, max, open, className = "xl:col-span-9" }) {
  return (
    <Card className={`rise flex flex-col ${className}`}>
      <Title title="My pipeline" sub={`${open} open leads`} action={<RoundLink href="/leads" label="Open the board" />} />
      <div className="mt-8 flex flex-1 items-end justify-between gap-3">
        {stages.map((s) => {
          const on = s === top && s.n > 0;
          return (
            <Link key={s.label} href={`/leads?view=list&status=${encodeURIComponent(s.q)}`} className="group flex flex-1 flex-col items-center gap-2">
              <span className="relative flex h-32 w-full max-w-[46px] items-end">
                <span className={`relative w-full rounded-full transition group-hover:brightness-110 ${on ? "bg-gradient-to-b from-brand-soft to-brand" : "hatch border border-line-strong bg-panel"}`} style={{ height: `${Math.max(26, (s.n / max) * 100)}%` }}>
                  {on && (
                    <span className="absolute -top-11 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-solid px-2 py-1 text-center text-[10px] leading-tight text-on-solid">
                      <b className="block text-[12px] font-medium">{s.n}</b>
                      leads
                    </span>
                  )}
                </span>
              </span>
              <span className={`text-[11px] ${on ? "font-medium text-ink" : "text-muted"}`}>{s.label}</span>
            </Link>
          );
        })}
      </div>
    </Card>
  );
}


/**
 *   data   dashboardData(me) — leads, upcoming, meetings, proposals, activity, now
 *   tasks  this person's tasks
 */
export default function UserHome({ me, data, tasks = [], followUps = [] }) {
  const { leads, upcoming, proposals, activity, now } = data;
  const today = dayKey(now);
  const d0 = new Date(now);
  const isLate = (t) => OPEN_TASK.includes(t.status) && t.due_at && new Date(t.due_at).getTime() < now;

  // ---- Tasks (makers) ----
  const openTasks = tasks.filter((t) => OPEN_TASK.includes(t.status));
  const lateTasks = openTasks.filter(isLate);
  const fixTasks = openTasks.filter((t) => t.status === "revision");
  const dueToday = openTasks.filter((t) => t.due_at && dayKey(t.due_at) === today && !isLate(t));
  const doToday = [...new Set([...fixTasks, ...lateTasks, ...dueToday])];
  const waiting = tasks.filter((t) => ["completed", "client_rejected", "sent_to_client"].includes(t.status));
  const approved = tasks.filter((t) => t.status === "done");
  const approvedWeek = approved.filter((t) => t.done_at && now - new Date(t.done_at).getTime() < 7 * DAY);
  const doesTasks = isMaker(me) || tasks.length > 0;

  // ---- Leads (sales) ----
  const openLeads = leads.filter((l) => !CLOSED_STATUSES.includes(l.status));
  const newWeek = leads.filter((l) => now - new Date(l.created_at).getTime() < 7 * DAY);
  const won = leads.filter((l) => l.status === "Won");
  const lost = leads.filter((l) => l.status === "Lost");
  const winRate = won.length + lost.length ? Math.round((won.length / (won.length + lost.length)) * 100) : null;
  const stale = openLeads
    .filter((l) => now - new Date(l.updated_at).getTime() > (l.status === "New Lead" ? 2 : 5) * DAY)
    .sort((a, b) => new Date(a.updated_at) - new Date(b.updated_at));
  const doesSales = isSales(me) && (openLeads.length > 0 || newWeek.length > 0);

  // ---- Briefs (strategists) ----
  const pool = proposals.filter((p) => !p.strategist_id);
  const mine = proposals.filter((p) => p.strategist_id === me.id);
  const mineLive = mine.filter((p) => p.stage !== "done");
  const delivered = mine.filter((p) => p.stage === "done");
  const needsDocs = mine.filter((p) => ["picked_up", "crl_failed"].includes(p.stage));
  const doesBriefs = isStrategist(me) && (mine.length > 0 || pool.length > 0);

  // The main job decides the hero and the red card
  const main = doesTasks && (tasks.length || !doesSales) ? "tasks" : doesSales ? "sales" : doesBriefs ? "briefs" : "tasks";

  // Today: one to-do list across everything this person does
  const clock = new Intl.DateTimeFormat("en-IN", { timeZone: IST, hour: "numeric", minute: "2-digit" });
  const todo = [
    ...followUps.map((l) => ({ key: `f${l.id}`, icon: "bell", href: `/leads/${l.id}`, title: `Call ${brandOf(l)}`, sub: `${new Date(l.follow_up_at).getTime() < now ? "Follow-up due" : `Follow up at ${clock.format(new Date(l.follow_up_at))}`}${l.follow_up_note ? ` · ${l.follow_up_note}` : ""}`, tone: "rose" })),
    ...(doesTasks ? doToday.map((t) => ({ key: `t${t.id}`, icon: t.status === "revision" ? "refresh" : isLate(t) ? "alert" : "tasks", href: `/tasks/${t.id}`, title: t.title, sub: `${t.brand?.name || ""} · ${t.status === "revision" ? "Fix needed" : isLate(t) ? "Late" : "Due today"}`, tone: isLate(t) || t.status === "revision" ? "rose" : "" })) : []),
    ...(doesSales ? stale.filter((l) => !followUps.some((f) => f.id === l.id)).map((l) => ({ key: `l${l.id}`, icon: "clock", href: `/leads/${l.id}`, title: `Follow up with ${brandOf(l)}`, sub: `${l.status} · no update for ${ago(l.updated_at).replace(" ago", "")}` })) : []),
    ...(doesBriefs ? [...pool.map((p) => ({ key: `b${p.id}`, icon: "brief", href: `/briefs/${p.lead.id}`, title: `New brief — ${brandOf(p.lead)}`, sub: `Shared ${ago(p.shared_at)} · pick it up` })), ...needsDocs.map((p) => ({ key: `d${p.id}`, icon: "upload", href: `/briefs/${p.lead.id}`, title: `Upload documents — ${brandOf(p.lead)}`, sub: "References, creatives, strategy, identity" }))] : []),
  ];

  // Week strip: dots for my meetings and my task due dates
  const monday = new Date(now - ((d0.getDay() + 6) % 7) * DAY);
  const week = Array.from({ length: 7 }, (_, i) => new Date(monday.getTime() + i * DAY));
  const dotsOn = (k) => upcoming.filter((m) => dayKey(m.starts_at) === k).length + openTasks.filter((t) => t.due_at && dayKey(t.due_at) === k).length;
  const agenda = upcoming.filter((m) => new Date(m.starts_at).getTime() < now + 2 * DAY).slice(0, 3);
  const weekMeetings = upcoming.filter((m) => new Date(m.starts_at).getTime() < week[6].getTime() + DAY).length;

  // My pipeline by stage (sales)
  const STAGES = [
    ["New", ["New Lead"]],
    ["Touchbase", ["First Call / Touchbase", "Follow-up Scheduled", "DNP"]],
    ["Discovery", ["Discovery Call"]],
    ["Proposal", ["Proposal Meeting Scheduled"]],
    ["Negotiation", ["Negotiation", "Waiting Client Decision"]],
  ].map(([label, st]) => ({ label, n: openLeads.filter((l) => st.includes(l.status)).length, q: st[0] }));
  const maxStage = Math.max(1, ...STAGES.map((s) => s.n));
  const top = STAGES.reduce((a, b) => (b.n > a.n ? b : a), STAGES[0]);

  const hero = {
    tasks: (
      <>
        <p className="text-xs text-muted">Your work</p>
        <h2 className="mt-1 text-[26px] font-normal leading-tight tracking-[-0.02em]">
          {doToday.length ? (
            <>
              {doToday.length} thing{doToday.length > 1 ? "s" : ""} to finish <span className="text-brand">today</span>
            </>
          ) : (
            <>
              You&apos;re <span className="text-brand">on track</span>
            </>
          )}
        </h2>
        <div className="mt-3 flex items-end gap-3">
          <span className="text-[52px] font-normal leading-none tracking-[-0.03em] tabular-nums">{openTasks.length}</span>
          <span className="mb-1.5 text-sm text-muted">open tasks</span>
          {lateTasks.length > 0 && <span className="mb-2 rounded-full bg-rose-400/15 px-2 py-0.5 text-[11px] font-medium text-rose-400">{lateTasks.length} late</span>}
        </div>
        <Bar pct={tasks.length ? (approved.length / tasks.length) * 100 : 0} label={`${approved.length} of ${tasks.length} tasks approved so far`} />
        <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
          <Tile icon="refresh" label="Fix needed" value={fixTasks.length} note={fixTasks.length ? "Sent back to you" : "Nothing to fix"} href="/tasks" />
          <Tile icon="clock" label="Waiting on others" value={waiting.length} note="With your head or the client" href="/tasks" />
          <Tile icon="check" label="Approved this week" value={approvedWeek.length} note={`${approved.length} in total`} href="/tasks" />
        </div>
      </>
    ),
    sales: (
      <>
        <p className="text-xs text-muted">Your leads</p>
        <h2 className="mt-1 text-[26px] font-normal leading-tight tracking-[-0.02em]">
          Close more deals <span className="text-brand">this month</span>
        </h2>
        <div className="mt-3 flex items-end gap-3">
          <span className="text-[52px] font-normal leading-none tracking-[-0.03em] tabular-nums">{openLeads.length}</span>
          <span className="mb-1.5 text-sm text-muted">open leads</span>
        </div>
        <Bar pct={openLeads.length ? ((openLeads.length - stale.length) / openLeads.length) * 100 : 0} label={`${openLeads.length - stale.length} of ${openLeads.length} leads updated recently`} />
        <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
          <Tile icon="leads" label="New this week" value={newWeek.length} note="Assigned to you" href="/leads" />
          <Tile icon="video" label="Meetings this week" value={weekMeetings} note="Discovery calls" href="/leads?view=list" />
          <Tile icon="check" label="Won" value={won.length} note={winRate === null ? "No deals closed yet" : `${winRate}% win rate`} href="/leads?view=list&status=Won" />
        </div>
      </>
    ),
    briefs: (
      <>
        <p className="text-xs text-muted">Your proposals</p>
        <h2 className="mt-1 text-[26px] font-normal leading-tight tracking-[-0.02em]">
          Make every pitch <span className="text-brand">a win</span>
        </h2>
        <div className="mt-3 flex items-end gap-3">
          <span className="text-[52px] font-normal leading-none tracking-[-0.03em] tabular-nums">{mineLive.length}</span>
          <span className="mb-1.5 text-sm text-muted">briefs in progress</span>
        </div>
        <Bar pct={mine.length ? (delivered.length / mine.length) * 100 : 0} label={`${delivered.length} of ${mine.length} delivered`} />
        <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
          <Tile icon="brief" label="Open briefs" value={pool.length} note={pool.length ? "Waiting to be picked up" : "Nothing new"} href="/briefs" />
          <Tile icon="upload" label="Need documents" value={needsDocs.length} note="Upload to start the CRL" href="/briefs?tab=mine" />
          <Tile icon="check" label="Delivered" value={delivered.length} note="Proposals ready" href="/briefs?tab=done" />
        </div>
      </>
    ),
  }[main];

  const red = {
    tasks: <RedCard title={lateTasks.length ? "Late" : "Do today"} value={lateTasks.length || doToday.length} unit={<>of {openTasks.length}<br />open tasks</>} note={lateTasks.length ? "Past the due date — finish these first" : "Fixes and work due today"} href="/tasks" items={(lateTasks.length ? lateTasks : doToday).map((t) => [t.id, t.title, `/tasks/${t.id}`])} />,
    sales: <RedCard title="Follow up" value={stale.length} unit={<>of {openLeads.length}<br />open leads</>} note="No update for a few days — call them today" href="/leads?view=list" items={stale.map((l) => [l.id, brandOf(l), `/leads/${l.id}`])} />,
    briefs: <RedCard title="Open briefs" value={pool.length} unit={<>waiting to be<br />picked up</>} note="Pick one up from Proposals" href="/briefs" items={pool.map((p) => [p.id, brandOf(p.lead), `/briefs/${p.lead.id}`])} />,
  }[main];

  // The second module next to the red card: the main job's detail
  const detail = {
    tasks: (
      <Card className="rise xl:col-span-9">
        <Title title="My tasks" sub="Press Start when you begin; open the task to upload and submit" action={<RoundLink href="/tasks" label="All my tasks" />} />
        {tasks.length ? <MyWork me={me} tasks={tasks} embedded /> : <Empty icon="tasks">No tasks yet. When someone assigns you work, it shows up here and on your phone.</Empty>}
      </Card>
    ),
    sales: <PipelineCard stages={STAGES} top={top} max={maxStage} open={openLeads.length} />,
    briefs: (
      <Card className="rise xl:col-span-9">
        <Title title="My proposals" sub="Brief → documents → CRL → commercials → deck" action={<RoundLink href="/briefs" label="Briefs" />} />
        <ProposalProgress proposals={[...mine, ...pool]} hrefFor={(p) => `/briefs/${p.lead.id}`} />
      </Card>
    ),
  };
  // Other jobs this person also does, as smaller cards under the main ones
  const extras = [
    ...(main !== "sales" && doesSales ? [<PipelineCard key="pipe" stages={STAGES} top={top} max={maxStage} open={openLeads.length} className="xl:col-span-6" />] : []),
    ...(main !== "briefs" && doesBriefs
      ? [
          <Card key="briefs" className="rise xl:col-span-6">
            <Title title="My proposals" sub={`${mineLive.length} in progress · ${pool.length} open briefs`} action={<RoundLink href="/briefs" label="Briefs" />} />
            <ProposalProgress proposals={[...mine, ...pool]} hrefFor={(p) => `/briefs/${p.lead.id}`} />
          </Card>,
        ]
      : []),
    ...(main !== "tasks" && doesTasks
      ? [
          <Card key="tasks" className="rise xl:col-span-6">
            <Title title="My tasks" sub={`${openTasks.length} open · ${lateTasks.length} late`} action={<RoundLink href="/tasks" label="My tasks" />} />
            <MyWork me={me} tasks={tasks} embedded />
          </Card>,
        ]
      : []),
    ...((doesSales || doesBriefs) && activity.length
      ? [
          <Card key="act" className="rise xl:col-span-6">
            <Title title="Recent activity" sub={doesSales ? "On your leads" : "On your briefs"} />
            <Activity events={activity} />
          </Card>,
        ]
      : []),
    ...(upcoming.length
      ? [
          <Card key="meet" className="rise xl:col-span-6">
            <Title title="Meetings" sub="Coming up" />
            <MeetingAgenda meetings={upcoming} now={now} />
          </Card>,
        ]
      : []),
  ];

  return (
    <div className="page">
      <h1 className="rise text-[26px] font-normal tracking-[-0.02em]">
        {greeting()}, {me.name.split(" ")[0]} 👋
      </h1>

      <div className="mt-4 grid gap-4 xl:grid-cols-12">
        <Card className="rise xl:col-span-8">{hero}</Card>

        {/* Today */}
        <Card className="rise flex flex-col xl:col-span-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-normal tracking-[-0.01em]">Today</h2>
              <p className="text-xs text-muted">{dateLine.format(d0)}</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-7 gap-1.5">
            {week.map((d) => {
              const k = dayKey(d);
              const on = k === today;
              const n = dotsOn(k);
              return (
                <div key={k} className={`flex flex-col items-center gap-0.5 rounded-2xl py-2 ${on ? "bg-solid text-on-solid" : "bg-panel-2"}`}>
                  <span className={`text-[10px] ${on ? "opacity-80" : "text-muted"}`}>{d.toLocaleDateString("en-IN", { timeZone: IST, weekday: "short" })}</span>
                  <span className="text-[15px] font-medium tabular-nums">{d.toLocaleDateString("en-IN", { timeZone: IST, day: "numeric" })}</span>
                  <span className="flex h-1 gap-0.5">
                    {Array.from({ length: Math.min(3, n) }, (_, i) => (
                      <span key={i} className={`h-1 w-1 rounded-full ${on ? "bg-white" : "bg-brand"}`} />
                    ))}
                  </span>
                </div>
              );
            })}
          </div>
          <ul className="mt-4 flex flex-col">
            {agenda.map((m) => (
              <li key={m.id} className="flex items-center gap-3 border-b border-line py-2.5 last:border-0">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand/12 text-brand">
                  <Icon name="video" size={14} />
                </span>
                <Link href={`/leads/${m.lead.id}`} className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">
                    {m.kind === "proposal" ? "Proposal meeting" : "Discovery call"} — {brandOf(m.lead)}
                  </span>
                  <span className="block truncate text-[11px] text-brand">
                    {dayKey(m.starts_at) === today ? "Today" : "Tomorrow"} · {time.format(new Date(m.starts_at))}
                  </span>
                </Link>
                {m.meet_link && (
                  <a href={m.meet_link} target="_blank" rel="noreferrer" className="rounded-full bg-panel-2 px-3 py-1 text-[11px] font-medium hover:bg-panel-3">
                    Join
                  </a>
                )}
              </li>
            ))}
            {todo.slice(0, Math.max(3, 6 - agenda.length)).map((it) => (
              <li key={it.key} className="border-b border-line last:border-0">
                <Link href={it.href} className="group flex items-center gap-3 py-2.5">
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${it.tone === "rose" ? "bg-rose-400/12 text-rose-400" : "bg-brand/12 text-brand"}`}>
                    <Icon name={it.icon} size={14} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium group-hover:text-brand">{it.title}</span>
                    <span className="block truncate text-[11px] text-muted">{it.sub}</span>
                  </span>
                  <span className="h-5 w-5 shrink-0 rounded-full border-[1.5px] border-line-strong transition group-hover:border-brand" />
                </Link>
              </li>
            ))}
            {!agenda.length && !todo.length && <li className="py-6 text-center text-sm text-muted">All clear for today ✓</li>}
          </ul>
          <div className="mt-auto grid grid-cols-3 gap-2 pt-4">
            {main === "tasks" ? (
              <>
                <Ring value={doToday.length} total={Math.max(doToday.length, openTasks.length)} label="Today" icon="tasks" />
                <Ring value={waiting.length} total={Math.max(waiting.length, tasks.length)} label="Waiting" icon="clock" />
                <Ring value={approvedWeek.length} total={Math.max(approvedWeek.length, approvedWeek.length + openTasks.length)} label="Approved" icon="check" />
              </>
            ) : main === "sales" ? (
              <>
                <Ring value={newWeek.length} total={Math.max(newWeek.length, 5)} label="New" icon="leads" />
                <Ring value={weekMeetings} total={Math.max(weekMeetings, 5)} label="Meetings" icon="video" />
                <Ring value={openLeads.length - stale.length} total={Math.max(1, openLeads.length)} label="On track" icon="check" />
              </>
            ) : (
              <>
                <Ring value={mineLive.length} total={Math.max(mineLive.length, mine.length)} label="In work" icon="brief" />
                <Ring value={needsDocs.length} total={Math.max(needsDocs.length, mineLive.length)} label="Docs" icon="upload" />
                <Ring value={delivered.length} total={Math.max(delivered.length, mine.length)} label="Done" icon="check" />
              </>
            )}
          </div>
        </Card>

        {/* The main job in detail, with its red card */}
        {detail[main]}
        <div className="xl:col-span-3">{red}</div>

        {extras}
      </div>
    </div>
  );
}
