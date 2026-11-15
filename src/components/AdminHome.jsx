// Admin / ops home. Three things only:
//   1. Needs you   — a plain to-do list across sales, proposals, clients and work
//   2. The agency  — Leads → Proposals → Clients → Work, one number each, tap to open
//   3. Meetings    — what's booked next
// Everything else (charts, team scores, activity) lives on its own page.
import Link from "next/link";
import Icon from "@/components/Icon";
import { MeetingAgenda } from "@/components/DashboardView";
import { CLOSED_STATUSES, OPEN_TASK, PROPOSAL_STAGES } from "@/lib/constants";
import { ago, fullName } from "@/lib/format";

const DAY = 864e5;
const IST = { timeZone: "Asia/Kolkata" };
const brandOf = (l) => l.brand || fullName(l);
function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-IN", { ...IST, hour: "numeric", hour12: false }).format(new Date()));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

const AREAS = {
  sales: { label: "Sales", color: "#60a5fa", icon: "leads" },
  proposal: { label: "Proposal", color: "#a78bfa", icon: "file" },
  client: { label: "Client", color: "#4ade80", icon: "brand" },
  work: { label: "Work", color: "#fbbf24", icon: "tasks" },
};

function Todo({ items }) {
  if (!items.length)
    return (
      <div className="flex items-center gap-4 rounded-2xl bg-panel-2 p-5">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-400/15 text-emerald-400">
          <Icon name="check" size={18} />
        </span>
        <div>
          <div className="text-[15px] font-medium">Nothing needs you right now</div>
          <div className="text-sm text-muted">New leads, decks to review and finished work show up here.</div>
        </div>
      </div>
    );
  return (
    <ul className="-mx-1 flex flex-col divide-y divide-line">
      {items.map((it) => {
        const a = AREAS[it.area];
        return (
          <li key={it.key}>
            <Link href={it.href} className="group flex items-center gap-4 rounded-2xl px-3 py-3.5 transition hover:bg-panel-2/60">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: `color-mix(in srgb, ${a.color} 16%, transparent)`, color: a.color }}>
                <Icon name={it.icon || a.icon} size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-medium leading-snug group-hover:text-brand">{it.title}</div>
                {it.sub && <div className="mt-0.5 truncate text-xs text-muted">{it.sub}</div>}
              </div>
              <span className="hidden shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium sm:inline" style={{ background: `color-mix(in srgb, ${a.color} 12%, transparent)`, color: a.color }}>
                {a.label}
              </span>
              <Icon name="chevron" size={14} className="-rotate-90 shrink-0 text-faint" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function Step({ n, area, href, value, title, lines }) {
  const coral = n === 1;
  const a = coral ? { ...AREAS[area], color: "#ffffff" } : AREAS[area];
  return (
    <Link href={href} className={`group relative flex flex-col gap-3 p-5 transition duration-300 hover:-translate-y-0.5 ${coral ? "card-coral" : "card"}`}>
      <div className="flex items-center gap-2 text-xs text-muted">
        <span className="grid h-6 w-6 place-items-center rounded-full text-[11px] font-semibold" style={{ background: `color-mix(in srgb, ${a.color} 18%, transparent)`, color: a.color }}>
          {n}
        </span>
        {a.label}
        <Icon name="arrow" size={13} className="ml-auto text-faint transition group-hover:translate-x-0.5 group-hover:text-ink" />
      </div>
      <div>
        <div className="text-[44px] font-light leading-none tracking-[-0.04em] tabular-nums">{value}</div>
        <div className="mt-1 text-sm">{title}</div>
      </div>
      <ul className="flex flex-col gap-1 text-xs text-muted">
        {lines.filter(Boolean).map(([text, warn]) => (
          <li key={text} className={warn ? (coral ? "font-medium text-white" : "font-medium text-brand") : ""}>
            {text}
          </li>
        ))}
      </ul>
    </Link>
  );
}

/**
 *   data    dashboardData(me): leads, upcoming, proposals, members, now
 *   brands  listBrands()
 *   tasks   every task (empty if this member can't see tasks)
 */
export default function AdminHome({ me, data, brands = [], tasks = [], actions }) {
  const { leads, upcoming, proposals, members, now } = data;
  const ownerName = Object.fromEntries(members.map((m) => [m.id, m.name]));

  // Numbers
  const open = leads.filter((l) => !CLOSED_STATUSES.includes(l.status));
  const newWeek = leads.filter((l) => now - new Date(l.created_at).getTime() < 7 * DAY).length;
  const unassigned = leads.filter((l) => !l.assigned_to && !CLOSED_STATUSES.includes(l.status));
  const liveProposals = proposals.filter((p) => p.stage !== "done");
  const deckReview = proposals.filter((p) => p.stage === "proposal_review");
  const commercials = proposals.filter((p) => p.stage === "awaiting_commercials");
  const failed = proposals.filter((p) => PROPOSAL_STAGES[p.stage]?.error);
  const active = brands.filter((b) => b.stage === "active");
  const mouOut = brands.filter((b) => b.stage === "mou_sent");
  const mouDraft = brands.filter((b) => b.stage === "mou_draft");
  const inWork = tasks.filter((t) => OPEN_TASK.includes(t.status));
  const late = inWork.filter((t) => t.due_at && new Date(t.due_at).getTime() < now);
  const toCheck = tasks.filter((t) => ["completed", "client_rejected"].includes(t.status));

  // To-do, most urgent first
  const todo = [];
  for (const p of failed) todo.push({ key: `f${p.id}`, area: "proposal", icon: "alert", href: `/leads/${p.lead.id}#proposal`, title: `${PROPOSAL_STAGES[p.stage].label} for ${brandOf(p.lead)}`, sub: "Open it and retry" });
  for (const p of deckReview) todo.push({ key: `r${p.id}`, area: "proposal", href: `/leads/${p.lead.id}#proposal`, title: `Review the proposal deck for ${brandOf(p.lead)}`, sub: `Version ${p.revision || 1} is ready${p.strategist ? ` · ${p.strategist.name}` : ""}` });
  for (const p of commercials) todo.push({ key: `c${p.id}`, area: "proposal", icon: "rupee", href: `/leads/${p.lead.id}#proposal`, title: `Add the commercials for ${brandOf(p.lead)}`, sub: "The deck is waiting on the pricing" });
  if (unassigned.length) todo.push({ key: "u", area: "sales", icon: "team", href: "/leads?view=list", title: unassigned.length === 1 ? `Assign the new lead ${brandOf(unassigned[0])}` : `Assign ${unassigned.length} new leads to the sales team`, sub: unassigned.slice(0, 3).map(brandOf).join(", ") });
  for (const b of mouDraft) todo.push({ key: `m${b.id}`, area: "client", icon: "file", href: `/leads/${b.lead?.id || ""}#onboarding`, title: `Send the MOU to ${b.name}`, sub: "They said yes — the MOU is still a draft" });
  for (const b of mouOut.filter((b) => b.mou_sent_at && now - new Date(b.mou_sent_at).getTime() > 3 * DAY)) todo.push({ key: `s${b.id}`, area: "client", icon: "clock", href: `/leads/${b.lead?.id || ""}#onboarding`, title: `Follow up on the MOU with ${b.name}`, sub: `Sent ${ago(b.mou_sent_at)}, not signed yet` });
  if (late.length) todo.push({ key: "late", area: "work", icon: "alert", href: "/tasks", title: `${late.length} task${late.length > 1 ? "s are" : " is"} late`, sub: [...new Set(late.map((t) => t.brand?.name).filter(Boolean))].slice(0, 4).join(", ") });
  if (toCheck.length) todo.push({ key: "check", area: "work", icon: "check", href: "/tasks", title: `${toCheck.length} finished task${toCheck.length > 1 ? "s" : ""} waiting to be checked`, sub: "The execution heads review these" });
  const stale = open
    .filter((l) => l.assigned_to && now - new Date(l.updated_at).getTime() > (l.status === "New Lead" ? 2 : 5) * DAY)
    .sort((a, b) => new Date(a.updated_at) - new Date(b.updated_at));
  if (stale.length) todo.push({ key: "stale", area: "sales", icon: "clock", href: "/leads?view=list", title: `${stale.length} lead${stale.length > 1 ? "s have" : " has"} had no update for days`, sub: stale.slice(0, 3).map((l) => `${brandOf(l)} (${ownerName[l.assigned_to]?.split(" ")[0] || "—"})`).join(", ") });

  const todayMeetings = upcoming.filter((m) => new Date(m.starts_at).getTime() < now + DAY).length;

  return (
    <div className="page">
      <header className="rise flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <h1 className="text-[34px] font-normal leading-tight tracking-[-0.03em] md:text-[44px]">
          {greeting()}, {me.name.split(" ")[0]} 👋
        </h1>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </header>

      <section className="rise mt-6 [animation-delay:40ms]">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Step n={1} area="sales" href="/leads" value={open.length} title="Open leads" lines={[[`${newWeek} new this week`], unassigned.length > 0 && [`${unassigned.length} not assigned`, true]]} />
          <Step n={2} area="proposal" href="/briefs" value={liveProposals.length} title="Proposals in progress" lines={[[`${proposals.filter((p) => p.stage === "done").length} ready`], deckReview.length + commercials.length > 0 && [`${deckReview.length + commercials.length} need you`, true]]} />
          <Step n={3} area="client" href="/brands" value={active.length} title="Active clients" lines={[mouOut.length > 0 && [`${mouOut.length} waiting to sign the MOU`], mouDraft.length > 0 && [`${mouDraft.length} MOU to send`, true], !mouOut.length && !mouDraft.length && ["All onboarded"]]} />
          <Step n={4} area="work" href="/tasks" value={inWork.length} title="Tasks in progress" lines={[[`${tasks.filter((t) => t.status === "sent_to_client").length} with clients`], late.length > 0 && [`${late.length} late`, true]]} />
        </div>
      </section>

      <div className="mt-4 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="rise card p-4 [animation-delay:80ms] sm:p-5">
          <div className="mb-3 flex items-end justify-between gap-3 px-1">
            <div>
              <h2 className="text-xl font-medium tracking-[-0.015em]">Needs you</h2>
              <p className="text-sm text-muted">{todo.length ? `${todo.length} thing${todo.length > 1 ? "s" : ""} — tap one to do it.` : "You're all caught up."}</p>
            </div>
            {todo.length > 0 && <span className="rounded-full bg-brand px-2.5 py-1 text-xs font-semibold text-white">{todo.length}</span>}
          </div>
          <Todo items={todo} />
        </section>

        <section className="rise card p-4 [animation-delay:120ms] sm:p-5">
          <div className="mb-3 px-1">
            <h2 className="text-xl font-medium tracking-[-0.015em]">Meetings</h2>
            <p className="text-sm text-muted">{todayMeetings ? `${todayMeetings} in the next 24 hours` : "Coming up"}</p>
          </div>
          <MeetingAgenda meetings={upcoming} now={now} />
        </section>
      </div>
    </div>
  );
}
