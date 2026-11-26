// Admin / ops home, laid out like the reference dashboard:
//   [ This month (hero)              ] [ Today      ]
//   [ Pipeline by stage ] [ Hot leads ] [ (agenda)   ]
//   [ Sales team ] [ Needs you ] [ Busiest client (dark) ]
import Link from "next/link";
import Icon from "@/components/Icon";
import { Avatar, BrandMark } from "@/components/ui";
import { MeetingAgenda } from "@/components/DashboardView";
import { CLOSED_STATUSES, OPEN_TASK, PROPOSAL_STAGES } from "@/lib/constants";
import { ago, fullName } from "@/lib/format";

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

function RoundLink({ href, icon = "arrow", label, light }) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full transition hover:-translate-y-0.5 ${light ? "bg-white/20 text-white hover:bg-white/30" : "border border-line bg-panel text-ink hover:bg-panel-2"}`}
    >
      <Icon name={icon} size={14} className={icon === "arrow" ? "-rotate-45" : ""} />
    </Link>
  );
}

/** A small ring with a number in the middle (the "This week" row). */
function Ring({ value, total, label, icon }) {
  const p = total ? Math.min(1, value / total) : 0;
  const r = 15;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative h-11 w-11">
        <svg viewBox="0 0 36 36" className="h-11 w-11 -rotate-90">
          <circle cx="18" cy="18" r={r} fill="none" stroke="var(--color-panel-3)" strokeWidth="3" />
          <circle cx="18" cy="18" r={r} fill="none" stroke="var(--color-brand)" strokeWidth="3" strokeLinecap="round" strokeDasharray={`${c * p} ${c}`} />
        </svg>
        <span className="absolute inset-0 grid place-items-center text-[10px] font-medium tabular-nums">
          {value}/{total}
        </span>
      </div>
      <span className="flex items-center gap-1 text-[11px] text-muted">
        <Icon name={icon} size={11} className="text-brand" />
        {label}
      </span>
    </div>
  );
}

/**
 *   data    dashboardData(me): leads, upcoming, proposals, members, now
 *   brands  listBrands()
 *   tasks   every task (empty if this member can't see tasks)
 */
export default function AdminOverview({ me, data, brands = [], tasks = [], actions, salesOnly = false, meetings = null }) {
  const { leads, upcoming, proposals, members, now } = data;
  const today = dayKey(now);
  const d0 = new Date(now);
  const monthStart = new Date(d0.getFullYear(), d0.getMonth(), 1).getTime();
  const lastMonthStart = new Date(d0.getFullYear(), d0.getMonth() - 1, 1).getTime();
  const at = (l) => new Date(l.created_at).getTime();

  // Leads
  const open = leads.filter((l) => !CLOSED_STATUSES.includes(l.status));
  const thisMonth = leads.filter((l) => at(l) >= monthStart);
  const lastMonth = leads.filter((l) => at(l) >= lastMonthStart && at(l) < monthStart);
  const change = lastMonth.length ? Math.round(((thisMonth.length - lastMonth.length) / lastMonth.length) * 100) : null;
  const target = Math.max(10, Math.ceil((lastMonth.length * 1.2) / 5) * 5);
  const newWeek = leads.filter((l) => now - at(l) < 7 * DAY);
  const unassigned = open.filter((l) => !l.assigned_to);
  const wonMonth = leads.filter((l) => l.status === "Won" && new Date(l.updated_at).getTime() >= monthStart);
  const closedMonth = leads.filter((l) => ["Won", "Lost"].includes(l.status) && new Date(l.updated_at).getTime() >= monthStart);

  // Proposals, clients, work
  const liveProposals = proposals.filter((p) => p.stage !== "done");
  const deckReview = proposals.filter((p) => p.stage === "proposal_review");
  const commercials = proposals.filter((p) => p.stage === "awaiting_commercials");
  const failed = proposals.filter((p) => PROPOSAL_STAGES[p.stage]?.error);
  const mouOut = brands.filter((b) => b.stage === "mou_sent");
  const mouDraft = brands.filter((b) => b.stage === "mou_draft");
  const inWork = tasks.filter((t) => OPEN_TASK.includes(t.status));
  const late = inWork.filter((t) => t.due_at && new Date(t.due_at).getTime() < now);
  const dueToday = inWork.filter((t) => t.due_at && dayKey(t.due_at) === today && !late.includes(t));
  const toCheck = tasks.filter((t) => ["completed", "client_rejected"].includes(t.status) && !t.with_lead);

  // Needs you — most urgent first
  const todo = [];
  for (const p of failed) todo.push({ key: `f${p.id}`, icon: "alert", href: `/leads/${p.lead.id}#proposal`, title: `${PROPOSAL_STAGES[p.stage].label} — ${brandOf(p.lead)}`, sub: "Open it and retry", tone: "rose" });
  for (const p of deckReview) todo.push({ key: `r${p.id}`, icon: "file", href: `/leads/${p.lead.id}#proposal`, title: `Review the deck for ${brandOf(p.lead)}`, sub: `Version ${p.revision || 1} is ready` });
  for (const p of commercials) todo.push({ key: `c${p.id}`, icon: "rupee", href: `/leads/${p.lead.id}#proposal`, title: `Add commercials for ${brandOf(p.lead)}`, sub: "The deck is waiting on pricing" });
  if (unassigned.length) todo.push({ key: "u", icon: "team", href: "/leads?view=list&owner=unassigned", title: unassigned.length === 1 ? `Assign ${brandOf(unassigned[0])}` : `Assign ${unassigned.length} new leads`, sub: unassigned.slice(0, 3).map(brandOf).join(", ") });
  for (const b of mouDraft) todo.push({ key: `m${b.id}`, icon: "file", href: `/leads/${b.lead?.id || ""}#onboarding`, title: `Send the MOU to ${b.name}`, sub: "They said yes — MOU still a draft" });
  for (const b of mouOut.filter((b) => b.mou_sent_at && now - new Date(b.mou_sent_at).getTime() > 3 * DAY)) todo.push({ key: `s${b.id}`, icon: "clock", href: `/leads/${b.lead?.id || ""}#onboarding`, title: `Follow up on ${b.name}'s MOU`, sub: `Sent ${ago(b.mou_sent_at)}` });
  if (toCheck.length) todo.push({ key: "check", icon: "check", href: "/tasks", title: `${toCheck.length} task${toCheck.length > 1 ? "s" : ""} to check`, sub: "Finished work waiting for review" });
  if (late.length) todo.push({ key: "late", icon: "alert", href: "/tasks", title: `${late.length} task${late.length > 1 ? "s" : ""} late`, sub: [...new Set(late.map((t) => t.brand?.name).filter(Boolean))].slice(0, 3).join(", "), tone: "rose" });

  // Pipeline by stage
  const STAGES = [
    ["New", ["New Lead"]],
    ["Touchbase", ["First Call / Touchbase", "Follow-up Scheduled", "DNP"]],
    ["Discovery", ["Discovery Call"]],
    ["Proposal", ["Proposal Meeting Scheduled"]],
    ["Negotiation", ["Negotiation", "Waiting Client Decision"]],
  ].map(([label, statuses]) => ({ label, n: open.filter((l) => statuses.includes(l.status)).length, q: statuses[0] }));
  const maxStage = Math.max(1, ...STAGES.map((s) => s.n));
  const top = STAGES.reduce((a, b) => (b.n > a.n ? b : a), STAGES[0]);

  // Hot / warm / cold by last activity
  const touched = (l) => now - new Date(l.updated_at).getTime();
  const hot = open.filter((l) => touched(l) <= 2 * DAY);
  const warm = open.filter((l) => touched(l) > 2 * DAY && touched(l) <= 7 * DAY);
  const cold = open.filter((l) => touched(l) > 7 * DAY);

  // Today: week strip + agenda
  const monday = new Date(now - ((d0.getDay() + 6) % 7) * DAY);
  const week = Array.from({ length: 7 }, (_, i) => new Date(monday.getTime() + i * DAY));
  const meetingsOn = (k) => upcoming.filter((m) => dayKey(m.starts_at) === k).length;
  const agenda = upcoming.filter((m) => new Date(m.starts_at).getTime() < now + 2 * DAY).slice(0, 4);
  const weekMeetings = upcoming.filter((m) => new Date(m.starts_at).getTime() < week[6].getTime() + DAY).length;
  const doneWeek = tasks.filter((t) => t.status === "done" && t.done_at && now - new Date(t.done_at).getTime() < 7 * DAY).length;

  // Sales team
  const sales = members
    .filter((m) => m.groups?.some((g) => g.kind === "sales"))
    .map((m) => ({ ...m, open: open.filter((l) => l.assigned_to === m.id).length, won: wonMonth.filter((l) => l.assigned_to === m.id).length }))
    .sort((a, b) => b.open - a.open)
    .slice(0, 4);
  const maxOpen = Math.max(1, ...sales.map((s) => s.open));

  // Busiest client: the active brand with the most work in progress
  const topBrand = brands
    .filter((b) => b.stage === "active")
    .map((b) => ({ ...b, open: inWork.filter((t) => t.brand?.id === b.id).length, done: tasks.filter((t) => t.brand?.id === b.id && t.status === "done").length }))
    .sort((a, b) => b.open - a.open || b.done - a.done)[0];

  return (
    <div className="page">
      <h1 className="rise text-[26px] font-normal tracking-[-0.02em]">
        {greeting()}, {me.name.split(" ")[0]} 👋
      </h1>
      {meetings && <div className="mt-4">{meetings}</div>}

      <div className="mt-4 grid gap-4 xl:grid-cols-12">
        {/* Hero */}
        <Card className="rise xl:col-span-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs text-muted">Leads this month · target {target}</p>
              <h2 className="mt-1 text-[26px] font-normal leading-tight tracking-[-0.02em]">
                Win more clients <span className="text-brand">this month</span>
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden items-center gap-2 rounded-full border border-line bg-panel py-1 pl-1 pr-3 sm:flex">
                <span className="flex -space-x-2">
                  {members.slice(0, 4).map((m) => (
                    <Avatar key={m.id} name={m.name} size={26} />
                  ))}
                </span>
                <span className="flex items-center gap-1 text-xs text-muted">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> {members.length} in team
                </span>
              </span>
              {actions}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-x-3 gap-y-1">
            <span className="text-[52px] font-normal leading-none tracking-[-0.03em] tabular-nums">{thisMonth.length}</span>
            <span className="mb-1.5 text-sm text-muted">new leads</span>
            {change !== null && (
              <span className={`mb-2 rounded-full px-2 py-0.5 text-[11px] font-medium ${change >= 0 ? "bg-emerald-400/15 text-emerald-500" : "bg-rose-400/15 text-rose-400"}`}>
                {change >= 0 ? "↑" : "↓"} {Math.abs(change)}% vs last month
              </span>
            )}
          </div>
          {/* progress to target, with the target marker */}
          <div className="relative mt-8">
            <div className="flex h-3 gap-1">
              <span className="rounded-full bg-gradient-to-r from-brand-soft to-brand" style={{ width: `${Math.max(3, Math.min(100, (thisMonth.length / target) * 100))}%` }} />
              <span className="hatch flex-1 rounded-full" />
            </div>
            <span className="absolute -top-7 right-[6%] flex flex-col items-center">
              <span className="rounded-md bg-solid px-1.5 py-0.5 text-[10px] font-medium text-on-solid">Target {target}</span>
              <span className="h-6 w-px bg-ink" />
            </span>
          </div>
          <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
            {[
              ["leads", "New this week", newWeek.length, unassigned.length ? `${unassigned.length} not assigned` : "All assigned", "/leads?view=list"],
              ["brief", "Proposals in progress", liveProposals.length, deckReview.length + commercials.length ? `${deckReview.length + commercials.length} need you` : `${proposals.filter((p) => p.stage === "done").length} ready`, "/briefs"],
              ["check", "Won this month", wonMonth.length, closedMonth.length ? `${Math.round((wonMonth.length / closedMonth.length) * 100)}% win rate` : "No deals closed yet", "/leads?view=list&status=Won"],
            ].map(([icon, label, value, note, href]) => (
              <Link key={label} href={href} className="flex items-center gap-3 rounded-2xl bg-panel-2 p-3 transition hover:bg-panel-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-panel text-brand shadow-[var(--card-shadow)]">
                  <Icon name={icon} size={15} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[11px] text-muted">{label}</span>
                  <span className="block text-lg font-medium leading-tight tabular-nums">{value}</span>
                  <span className="block truncate text-[11px] text-muted">{note}</span>
                </span>
              </Link>
            ))}
          </div>
        </Card>

        {/* Today */}
        <Card className="rise flex flex-col xl:col-span-4 xl:row-span-2">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-normal tracking-[-0.01em]">Today</h2>
              <p className="text-xs text-muted">{dateLine.format(d0)}</p>
            </div>
            <RoundLink href="/leads/new" icon="plus" label="New lead" />
          </div>
          <div className="mt-4 grid grid-cols-7 gap-1.5">
            {week.map((d) => {
              const k = dayKey(d);
              const on = k === today;
              const n = meetingsOn(k);
              return (
                <div key={k} className={`flex flex-col items-center gap-0.5 rounded-2xl py-2 ${on ? "bg-solid text-on-solid" : "bg-panel-2"}`}>
                  <span className={`text-[10px] ${on ? "opacity-70" : "text-muted"}`}>{d.toLocaleDateString("en-IN", { timeZone: IST, weekday: "short" })}</span>
                  <span className="text-[15px] font-medium tabular-nums">{d.toLocaleDateString("en-IN", { timeZone: IST, day: "numeric" })}</span>
                  <span className="flex h-1 gap-0.5">
                    {Array.from({ length: Math.min(3, n) }, (_, i) => (
                      <span key={i} className="h-1 w-1 rounded-full bg-brand" />
                    ))}
                  </span>
                </div>
              );
            })}
          </div>
          <ul className="mt-4 flex flex-col">
            {agenda.map((m) => (
              <li key={m.id} className="flex items-center gap-3 border-b border-line py-2.5 last:border-0">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand/10 text-brand">
                  <Icon name="video" size={14} />
                </span>
                <Link href={`/leads/${m.lead.id}`} className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">
                    {m.kind === "proposal" ? "Proposal meeting" : "Discovery call"} — {brandOf(m.lead)}
                  </span>
                  <span className="block truncate text-[11px] text-brand">
                    {dayKey(m.starts_at) === today ? "Today" : "Tomorrow"} · {time.format(new Date(m.starts_at))}
                    <span className="text-muted">{m.organizer ? ` · ${m.organizer.name}` : ""}</span>
                  </span>
                </Link>
                {m.meet_link && (
                  <a href={m.meet_link} target="_blank" rel="noreferrer" className="rounded-full bg-panel-2 px-3 py-1 text-[11px] font-medium hover:bg-panel-3">
                    Join
                  </a>
                )}
              </li>
            ))}
            {todo.slice(0, Math.max(2, 6 - agenda.length)).map((it) => (
              <li key={it.key} className="border-b border-line last:border-0">
                <Link href={it.href} className="group flex items-center gap-3 py-2.5">
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${it.tone === "rose" ? "bg-rose-400/12 text-rose-400" : "bg-brand/10 text-brand"}`}>
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
            {!agenda.length && !todo.length && <li className="py-6 text-center text-sm text-muted">Nothing on today ✓</li>}
          </ul>
          <div className="mt-auto pt-4">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium">
                This week <span className="font-normal text-muted">· {doneWeek} approved</span>
              </span>
              <Link href="/tasks" className="flex items-center gap-1 text-xs text-muted hover:text-ink">
                All tasks <Icon name="arrow" size={12} />
              </Link>
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2">
              <Ring value={newWeek.length} total={Math.max(newWeek.length, Math.ceil(target / 4))} label="Leads" icon="leads" />
              <Ring value={weekMeetings} total={Math.max(weekMeetings, 5)} label="Meetings" icon="video" />
              <Ring value={liveProposals.length} total={Math.max(liveProposals.length, proposals.length)} label="Decks" icon="brief" />
              <Ring value={doneWeek} total={Math.max(doneWeek, doneWeek + inWork.length)} label="Tasks" icon="tasks" />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {[
                ["Late", late.length, "text-rose-400"],
                ["Today", dueToday.length, ""],
                ["To check", toCheck.length, ""],
              ].map(([l, v, cls]) => (
                <Link key={l} href="/tasks" className="flex items-center justify-between rounded-xl bg-panel-2 px-3 py-2 text-[11px] text-muted hover:bg-panel-3">
                  {l}
                  <b className={`text-[13px] font-medium tabular-nums ${v && cls ? cls : "text-ink"}`}>{v}</b>
                </Link>
              ))}
            </div>
          </div>
        </Card>

        {/* Pipeline by stage */}
        <Card className="rise flex flex-col xl:col-span-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-normal tracking-[-0.01em]">Pipeline by stage</h2>
              <p className="mt-1 text-[30px] leading-none tracking-[-0.02em] tabular-nums">
                {open.length} <span className="text-sm text-muted">open leads</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/leads" className="rounded-full bg-panel-2 px-3 py-2 text-xs font-medium hover:bg-panel-3">
                Open pipeline
              </Link>
              <RoundLink href="/leads" label="Open the pipeline" />
            </div>
          </div>
          <div className="mt-10 flex flex-1 items-end justify-between gap-3">
            {STAGES.map((s) => {
              const on = s === top && s.n > 0;
              return (
                <Link key={s.label} href={`/leads?view=list&status=${encodeURIComponent(s.q)}`} className="group flex flex-1 flex-col items-center gap-2">
                  <span className="relative flex h-36 w-full max-w-[46px] items-end">
                    <span
                      className={`relative w-full rounded-full transition group-hover:brightness-95 ${on ? "bg-gradient-to-b from-brand-soft to-brand shadow-[0_10px_24px_-10px_rgb(232_101_79/0.8)]" : "hatch border border-line-strong bg-panel"}`}
                      style={{ height: `${Math.max(26, (s.n / maxStage) * 100)}%` }}
                    >
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

        {/* Hot leads */}
        <section className="card-coral rise flex flex-col p-5 xl:col-span-3">
          <div className="flex items-start justify-between">
            <h2 className="text-xl font-normal tracking-[-0.01em]">Hot leads</h2>
            <RoundLink href="/leads?view=list" label="See leads" light />
          </div>
          <div className="mt-5 flex items-end gap-2">
            <span className="text-[64px] font-light leading-none tabular-nums">{hot.length}</span>
            <span className="mb-2 text-xs leading-tight text-white/80">
              of {open.length}
              <br />
              open leads
            </span>
          </div>
          <p className="mt-1 text-[11px] text-white/75">Worked on in the last 2 days</p>
          <div className="mt-auto flex flex-col gap-2.5 pt-5">
            {[
              ["Hot", "≤2d", hot.length],
              ["Warm", "≤7d", warm.length],
              ["Cold", "7d+", cold.length],
            ].map(([l, h, n]) => (
              <div key={l} className="flex items-center gap-3 text-[11px]">
                <span className="w-16 shrink-0 text-white/90">
                  {l} <span className="text-white/60">{h}</span>
                </span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/25">
                  <span className="block h-full rounded-full bg-white" style={{ width: `${open.length ? (n / open.length) * 100 : 0}%` }} />
                </span>
                <span className="w-5 text-right font-medium tabular-nums">{n}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Sales team */}
        <Card className="rise xl:col-span-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-normal tracking-[-0.01em]">Sales team</h2>
              <p className="text-xs text-muted">Open leads per person</p>
            </div>
            <RoundLink href="/leads?view=list" label="Leads" />
          </div>
          <ul className="mt-4 flex flex-col gap-3.5">
            {sales.map((m) => (
              <li key={m.id} className="flex items-center gap-3">
                <Avatar name={m.name} size={34} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2 text-[13px]">
                    <span className="truncate font-medium">{m.name}</span>
                    {m.won > 0 && <span className="rounded-full bg-emerald-400/15 px-1.5 text-[10px] font-semibold text-emerald-500">{m.won} won</span>}
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="flex h-1.5 flex-1 gap-1">
                      <span className="rounded-full bg-brand" style={{ width: `${Math.max(4, (m.open / maxOpen) * 100)}%` }} />
                      <span className="hatch flex-1 rounded-full" />
                    </span>
                    <span className="w-6 text-right text-[11px] tabular-nums text-muted">{m.open}</span>
                  </div>
                </div>
              </li>
            ))}
            {!sales.length && <li className="py-4 text-center text-sm text-muted">Add people to a sales group on the Team page.</li>}
          </ul>
        </Card>

        {/* Needs you */}
        <Card className="rise xl:col-span-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-normal tracking-[-0.01em]">Needs you</h2>
              <p className="text-xs text-muted">{todo.length ? `${todo.length} thing${todo.length > 1 ? "s" : ""} to do` : "All caught up"}</p>
            </div>
            {todo.length > 0 && <span className="grid h-9 min-w-9 place-items-center rounded-full bg-brand px-2 text-sm font-medium text-white">{todo.length}</span>}
          </div>
          <ul className="mt-3 flex flex-col">
            {todo.slice(0, 5).map((it) => (
              <li key={it.key} className="border-b border-line last:border-0">
                <Link href={it.href} className="group flex items-center gap-3 py-2.5">
                  <span className="h-5 w-5 shrink-0 rounded-full border-[1.5px] border-line-strong transition group-hover:border-brand" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium group-hover:text-brand">{it.title}</span>
                    <span className="block truncate text-[11px] text-muted">{it.sub}</span>
                  </span>
                  <Icon name="arrow" size={13} className="text-faint" />
                </Link>
              </li>
            ))}
            {!todo.length && <li className="py-6 text-center text-sm text-muted">Nothing needs you right now ✓</li>}
          </ul>
        </Card>

        {salesOnly ? (
          <Card className="rise xl:col-span-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-normal tracking-[-0.01em]">Meetings</h2>
                <p className="text-xs text-muted">Your team&apos;s discovery calls</p>
              </div>
            </div>
            <div className="mt-3">
              <MeetingAgenda meetings={upcoming} now={now} />
            </div>
          </Card>
        ) : (
          <section className="rise flex flex-col rounded-[24px] bg-[#18181b] p-5 text-white shadow-[0_24px_50px_-28px_rgb(0_0_0/0.7)] xl:col-span-4">
            {topBrand ? (
              <>
                <div className="flex items-start justify-between">
                  <span className="flex items-center gap-1.5 text-xs text-white/60">
                    <span className="h-1.5 w-1.5 rounded-full bg-brand" /> Busiest client
                  </span>
                  <BrandMark name={topBrand.name} size={30} />
                </div>
                <h2 className="mt-3 text-[26px] font-normal leading-tight tracking-[-0.02em]">{topBrand.name}</h2>
                <p className="text-xs text-white/55">{(topBrand.services || []).map((s) => s.name).join(" · ") || "Active client"}</p>
                <div className="mt-5 grid grid-cols-2 gap-2">
                  <div className="rounded-2xl bg-white/[0.07] p-3">
                    <div className="text-[11px] text-white/55">In progress</div>
                    <div className="text-2xl font-light tabular-nums">{topBrand.open}</div>
                  </div>
                  <div className="rounded-2xl bg-white/[0.07] p-3">
                    <div className="text-[11px] text-white/55">Approved</div>
                    <div className="text-2xl font-light tabular-nums">{topBrand.done}</div>
                  </div>
                </div>
                <Link href={`/brands/${topBrand.id}`} className="mt-5 flex items-center justify-between rounded-full bg-white px-4 py-2.5 text-[13px] font-medium text-[#141416] transition hover:bg-white/90">
                  Open workspace <Icon name="arrow" size={14} />
                </Link>
              </>
            ) : (
              <p className="m-auto text-sm text-white/60">Your first client shows up here once they sign.</p>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
