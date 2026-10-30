import { Fragment } from "react";
import Link from "next/link";
import LeadsTrend from "@/components/LeadsTrend";
import Icon from "@/components/Icon";
import StatusBadge from "@/components/StatusBadge";
import { describe } from "@/components/Timeline";
import { Avatar, CornerLink, Empty, Panel, Stat } from "@/components/ui";
import { canCreateLead, canSeeAllLeads, canSeeLeads, isAdmin, isStrategist } from "@/lib/permissions";
import { CLOSED_STATUSES, MEETING_KINDS, PROPOSAL_STAGES, STATUSES } from "@/lib/constants";
import { ago, dayKey, fullName } from "@/lib/format";


const DAY = 864e5;
const IST = { timeZone: "Asia/Kolkata" };
const shortDay = new Intl.DateTimeFormat("en-IN", { ...IST, day: "numeric", month: "short" });
const weekday = new Intl.DateTimeFormat("en-IN", { ...IST, weekday: "long", day: "numeric", month: "long" });
const timeOnly = new Intl.DateTimeFormat("en-IN", { ...IST, hour: "numeric", minute: "2-digit" });
const brandOf = (l) => l.brand || fullName(l);

function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-IN", { ...IST, hour: "numeric", hour12: false }).format(new Date()));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

/** Counts per India-time day for the last `n` days, oldest first. */
function perDay(items, now, n, field = "created_at") {
  const counts = {};
  for (const x of items) counts[dayKey(x[field])] = (counts[dayKey(x[field])] || 0) + 1;
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(now - (n - 1 - i) * DAY);
    const key = dayKey(d);
    return { key, label: shortDay.format(d), count: counts[key] || 0 };
  });
}

const pct = (a, b) => (b ? Math.round(((a - b) / b) * 100) : null);

/* ------------------------------------------------------------------ */

/** Pastel cards for the things that need someone to act — the most urgent first. */
function AttentionCards({ items }) {
  if (!items.length) return <Empty>You&apos;re all caught up.</Empty>;
  return (
    <ul className="flex flex-col gap-3">
      {items.map((it) => (
        <li key={it.key}>
          <Link href={it.href} className={`card-hover group relative block overflow-hidden rounded-[24px] p-5 tint-${it.tint}`}>
            <span className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full bg-white/60 text-ink/60 backdrop-blur transition duration-300 group-hover:rotate-[-45deg] group-hover:bg-white group-hover:text-ink dark:bg-white/10">
              <Icon name="arrow" size={14} />
            </span>
            <div className="pr-10 text-[17px] font-medium leading-snug">{it.title}</div>
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink/60">{it.sub}</p>
            <div className="mt-5 flex items-center gap-2.5">
              <span className="icon-tile h-8 w-8 rounded-lg">
                <Icon name={it.icon} size={14} />
              </span>
              <span className="text-xs font-medium text-ink/70">{it.code}</span>
              {it.person && (
                <span className="ml-auto rounded-full p-0.5 ring-1 ring-white/70">
                  <Avatar name={it.person} size={28} />
                </span>
              )}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Each live proposal as a progress row: dark tile, name + stage, bar, big percentage. */
function ProposalProgress({ proposals, hrefFor }) {
  const live = proposals.filter((p) => p.stage !== "done");
  if (!live.length) return <Empty icon="sparkle">No proposals in progress.</Empty>;
  return (
    <ul className="flex flex-col gap-1">
      {live.slice(0, 5).map((p) => {
        const info = PROPOSAL_STAGES[p.stage] || PROPOSAL_STAGES.brief_shared;
        const pctDone = Math.round((info.step / 5) * 100);
        return (
          <li key={p.id}>
            <Link href={hrefFor(p)} className="-mx-2 flex items-center gap-3.5 rounded-2xl px-2 py-2.5 transition hover:bg-panel-2">
              <span className={`icon-tile ${info.error ? "!bg-rose-500 !text-white" : ""}`}>
                <Icon name={info.error ? "alert" : p.stage === "awaiting_commercials" ? "rupee" : info.step >= 2 ? "sparkle" : "brief"} size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{brandOf(p.lead)}</div>
                <div className="mt-0.5 truncate text-[11px] text-muted">{info.label}</div>
                <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-panel-2 shadow-[inset_0_1px_1px_rgb(23_22_29/0.06)]">
                  <span className={info.error ? "block h-full rounded-full bg-rose-400" : "bar-fill"} style={{ width: `${Math.max(6, pctDone)}%` }} />
                </span>
              </div>
              <span className="w-14 text-right text-2xl font-medium tracking-[-0.02em]">{pctDone}%</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Sales team: avatar, name, the small numbers, and leads owned as the big number. */
function TeamScores({ team, showWon }) {
  if (!team.length) return <Empty icon="team">Add people to the Sales Executives group under Team.</Empty>;
  return (
    <ul className="flex flex-col gap-1">
      {team.slice(0, 6).map((m) => (
        <li key={m.id}>
          <Link href={`/leads?owner=${m.id}`} className="-mx-2 flex items-center gap-3 rounded-2xl px-2 py-2 transition hover:bg-panel-2">
            <Avatar name={m.name} size={42} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{m.name}</div>
              <div className="mt-0.5 flex gap-2.5 text-[11px] text-muted">
                <span>{m.open} open</span>
                <span>{m.calls} calls</span>
                {showWon && <span className="text-emerald-400">{m.won} won</span>}
              </div>
            </div>
            <span className="text-2xl font-medium tracking-[-0.02em]" title="Leads assigned">
              {m.assigned}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function MeetingAgenda({ meetings, now }) {
  if (!meetings.length) return <Empty icon="calendar">No meetings booked.</Empty>;
  const today = dayKey(now);
  const tomorrow = dayKey(now + DAY);
  return (
    <ul className="flex flex-col gap-2">
      {meetings.slice(0, 6).map((m) => {
        const k = dayKey(m.starts_at);
        const day = k === today ? "Today" : k === tomorrow ? "Tomorrow" : shortDay.format(new Date(m.starts_at));
        const kind = MEETING_KINDS[m.kind];
        return (
          <li key={m.id}>
            <Link href={`/leads/${m.lead.id}`} className="flex items-center gap-3 rounded-2xl bg-panel-2 px-3 py-2.5 transition duration-200 hover:-translate-y-0.5 hover:bg-panel-3">
              <span className="w-[76px] shrink-0 rounded-xl bg-panel px-2 py-1.5 text-center leading-tight shadow-[0_1px_2px_rgb(23_22_29/0.06),0_4px_10px_-6px_rgb(90_70_170/0.25)]">
                <span className="block text-[10px] text-muted">{day}</span>
                <span className="block whitespace-nowrap text-xs font-medium tabular-nums">{timeOnly.format(new Date(m.starts_at))}</span>
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{brandOf(m.lead)}</div>
                <div className="mt-0.5 flex items-center gap-1.5 truncate text-[11px] text-muted">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: kind.color }} />
                  {kind.label} · {m.organizer?.name || "—"}
                </div>
              </div>
              {m.meet_link && (
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full solid">
                  <Icon name="video" size={13} />
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function Activity({ events }) {
  if (!events.length) return <Empty icon="clock">No activity yet.</Empty>;
  return (
    <ol className="flex flex-col gap-4">
      {events.slice(0, 7).map((e) => (
        <li key={e.id} className="flex gap-3">
          {e.actor?.name ? (
            <Avatar name={e.actor.name} size={32} />
          ) : (
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-tint-lavender text-brand">
              <Icon name="sparkle" size={13} />
            </span>
          )}
          <div className="min-w-0 flex-1 text-xs">
            <div className="text-muted">
              <Link href={`/leads/${e.lead.id}`} className="text-sm font-medium text-ink hover:text-brand">
                {brandOf(e.lead)}
              </Link>{" "}
              <span className="text-faint">{e.lead.code}</span>
            </div>
            <div className="mt-0.5 line-clamp-2 text-muted [&_a]:hidden">{describe(e)}</div>
            <div className="mt-0.5 text-[11px] text-faint">
              {e.actor?.name || "Website / bot"} · {ago(e.created_at)}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

function PipelineBars({ leads }) {
  const by = Object.fromEntries(STATUSES.map((s) => [s.name, 0]));
  for (const l of leads) if (l.status in by) by[l.status]++;
  const max = Math.max(1, ...Object.values(by));
  return (
    <ul className="flex flex-col gap-1">
      {STATUSES.map((s) => (
        <li key={s.name}>
          <Link
            href={`/leads?view=list&status=${encodeURIComponent(s.name)}`}
            className="-mx-2 grid grid-cols-[minmax(0,150px)_1fr_28px] items-center gap-3 rounded-xl px-2 py-1.5 transition hover:bg-panel-2"
          >
            <span className="flex min-w-0 items-center gap-2 text-xs">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color, boxShadow: `0 0 0 3px color-mix(in srgb, ${s.color} 20%, transparent)` }} />
              <span className="truncate">{s.name}</span>
            </span>
            <span className="h-2 overflow-hidden rounded-full bg-panel-2 shadow-[inset_0_1px_1px_rgb(23_22_29/0.06)]">
              <span
                className="block h-full rounded-full"
                style={{ width: by[s.name] ? `${Math.max(4, (by[s.name] / max) * 100)}%` : 0, background: `linear-gradient(90deg, color-mix(in srgb, ${s.color} 55%, transparent), ${s.color})` }}
              />
            </span>
            <span className="text-right text-sm font-medium tabular-nums">{by[s.name]}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ */

/** The dashboard for one member — admin / ops, sales executive or creative strategist. */
export default function DashboardView({ me, data }) {
  const staff = canSeeAllLeads(me);
  const sales = !staff && canSeeLeads(me);
  const strategist = !staff && isStrategist(me);
  const admin = isAdmin(me);
  const { leads, upcoming, meetings, members, proposals, activity, now } = data;

  // Lead numbers
  const created = (from, to) => leads.filter((l) => {
    const t = new Date(l.created_at).getTime();
    return t >= now - from * DAY && t < now - to * DAY;
  }).length;
  const thisWeek = created(7, 0);
  const lastWeek = created(14, 7);
  const open = leads.filter((l) => !CLOSED_STATUSES.includes(l.status));
  const won = leads.filter((l) => l.status === "Won");
  const lost = leads.filter((l) => l.status === "Lost");
  const winRate = won.length + lost.length ? Math.round((won.length / (won.length + lost.length)) * 100) : null;
  const meetingsWeek = upcoming.filter((m) => new Date(m.starts_at).getTime() < now + 7 * DAY);
  const days30 = perDay(leads, now, 30);
  const ownerName = Object.fromEntries(members.map((m) => [m.id, m.name]));

  // Things that need someone to act, as pastel cards
  const actions = [];
  if (staff) {
    for (const p of proposals.filter((p) => p.stage === "awaiting_commercials"))
      actions.push({ key: `c${p.id}`, href: `/leads/${p.lead.id}#proposal`, icon: "rupee", tint: "lavender", title: `Enter commercials — ${brandOf(p.lead)}`, sub: "The CRL is ready. The proposal bot waits for the commercials.", code: p.lead.code, person: p.strategist?.name });
    for (const p of proposals.filter((p) => PROPOSAL_STAGES[p.stage]?.error))
      actions.push({ key: `f${p.id}`, href: `/leads/${p.lead.id}#proposal`, icon: "alert", tint: "pink", title: `${PROPOSAL_STAGES[p.stage].label} — ${brandOf(p.lead)}`, sub: p.error || "Open the lead to retry.", code: p.lead.code, person: p.strategist?.name });
    for (const l of leads.filter((l) => !l.assigned_to).slice(0, 5))
      actions.push({ key: `u${l.id}`, href: `/leads/${l.id}`, icon: "team", tint: "blue", title: `Assign ${brandOf(l)}`, sub: `New lead${l.service ? ` for ${l.service}` : ""} · came in ${ago(l.created_at)}`, code: l.code });
  }
  if (staff || sales) {
    const stale = open
      .filter((l) => l.assigned_to && now - new Date(l.updated_at).getTime() > (l.status === "New Lead" ? 2 : 5) * DAY)
      .sort((a, b) => new Date(a.updated_at) - new Date(b.updated_at))
      .slice(0, 5);
    for (const l of stale)
      actions.push({ key: `s${l.id}`, href: `/leads/${l.id}`, icon: "clock", tint: "green", title: `Follow up with ${brandOf(l)}`, sub: `${l.status} · no update for ${ago(l.updated_at).replace(" ago", "")}`, code: l.code, person: staff ? ownerName[l.assigned_to] : null });
  }
  if (strategist) {
    for (const p of proposals.filter((p) => !p.strategist_id))
      actions.push({ key: `b${p.id}`, href: `/briefs/${p.lead.id}`, icon: "brief", tint: "lavender", title: `New brief — ${brandOf(p.lead)}`, sub: `${p.lead.service || "Service not set"} · shared ${ago(p.shared_at)}`, code: p.lead.code });
    for (const p of proposals.filter((p) => p.strategist_id === me.id && ["picked_up", "crl_failed"].includes(p.stage)))
      actions.push({ key: `d${p.id}`, href: `/briefs/${p.lead.id}`, icon: "upload", tint: p.stage === "crl_failed" ? "pink" : "amber", title: `Upload documents — ${brandOf(p.lead)}`, sub: p.stage === "crl_failed" ? "The CRL bot failed — check the documents." : "Reference links, creatives, strategy and identity.", code: p.lead.code });
  }

  // Sales team (admin / ops)
  const team = staff
    ? members
        .filter((m) => m.groups.some((g) => g.kind === "sales") || leads.some((l) => l.assigned_to === m.id))
        .map((m) => {
          const mine = leads.filter((l) => l.assigned_to === m.id);
          return {
            ...m,
            assigned: mine.length,
            open: mine.filter((l) => !CLOSED_STATUSES.includes(l.status)).length,
            calls: meetings.filter((x) => x.kind === "discovery" && x.organizer?.id === m.id).length,
            won: mine.filter((l) => l.status === "Won").length,
          };
        })
        .sort((a, b) => (admin ? b.won - a.won : 0) || b.assigned - a.assigned)
    : [];

  const myProposals = proposals.filter((p) => p.strategist_id === me.id);
  const pool = proposals.filter((p) => !p.strategist_id);
  const firstName = me.name.split(" ")[0];
  const waiting = actions.length;
  const proposalHref = (p) => (staff ? `/leads/${p.lead.id}#proposal` : `/briefs/${p.lead.id}`);

  const agenda = (
    <Panel title="Agenda" sub="Upcoming meetings" action={<CornerLink href="/leads?view=list" icon="calendar" label="Leads" />}>
      <MeetingAgenda meetings={upcoming} now={now} />
    </Panel>
  );
  const activityPanel = (
    <Panel title="Recent activity" sub="Across your leads">
      <Activity events={activity} />
    </Panel>
  );
  const proposalPanel = (
    <Panel title="Proposals" sub="Brief → documents → CRL → commercials → deck" action={<CornerLink href="/briefs" label="All briefs" />}>
      <ProposalProgress proposals={staff ? proposals : [...myProposals, ...pool]} hrefFor={proposalHref} />
    </Panel>
  );

  // What goes where, per role
  let topRight;
  let bottomRight = [];
  let lowerRow = [];
  if (staff) {
    topRight = admin ? (
      <Panel title="Leads per day" sub="New leads over the last 30 days" action={<CornerLink href="/leads?view=list" label="All leads" />}>
        <LeadsTrend days={days30} />
      </Panel>
    ) : (
      agenda
    );
    bottomRight = [
      proposalPanel,
      <Panel key="team" title="Sales team" sub={admin ? "Leads owned, calls (90 days) and wins" : "Leads owned and calls (90 days)"} action={<CornerLink href="/team" icon="team" label="Team" />}>
        <TeamScores team={team} showWon={admin} />
      </Panel>,
    ];
    lowerRow = admin
      ? [
          agenda,
          activityPanel,
          <Panel key="stages" title="Pipeline by stage" sub={`${leads.length} leads`} action={<CornerLink href="/leads" icon="board" label="Board" />}>
            <PipelineBars leads={leads} />
          </Panel>,
        ]
      : [activityPanel];
  } else if (sales) {
    topRight = agenda;
    bottomRight = [
      <Panel key="latest" title="Latest leads" sub="Assigned to you" action={<CornerLink href="/leads?view=list" label="All leads" />}>
        {leads.length ? (
          <ul className="flex flex-col gap-1">
            {leads.slice(0, 6).map((l) => (
              <li key={l.id}>
                <Link href={`/leads/${l.id}`} className="-mx-2 flex items-center gap-3 rounded-2xl px-2 py-2 transition hover:bg-panel-2">
                  <Avatar name={brandOf(l)} size={36} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{brandOf(l)}</span>
                    <span className="block text-[11px] text-muted">{l.code}</span>
                  </span>
                  <StatusBadge status={l.status} />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <Empty icon="leads">No leads yet.</Empty>
        )}
      </Panel>,
      activityPanel,
    ];
  } else {
    topRight = proposalPanel;
    bottomRight = [activityPanel];
  }

  return (
    <div className="page">
      {/* Title + headline numbers */}
      <header className="rise flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
        <div className="min-w-0">
          <p className="text-sm text-muted">
            {greeting()}, {firstName} · {weekday.format(new Date(now))}
          </p>
          <h1 className="page-title mt-1">Dashboard</h1>
        </div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-5 sm:flex sm:gap-0 sm:divide-x sm:divide-ink/[0.08] sm:[&>*]:px-8 sm:[&>*:first-child]:pl-0 sm:[&>*:last-child]:pr-0">
          {staff || sales ? (
            <>
              <Stat label={staff ? "New leads · 7 days" : "New to me · 7 days"} value={thisWeek} delta={pct(thisWeek, lastWeek)} />
              <Stat label={staff ? "Open pipeline" : "My open leads"} value={open.length} />
              <Stat label="Meetings · 7 days" value={meetingsWeek.length} />
              {admin && <Stat label="Won" value={won.length} sub={winRate == null ? null : `${winRate}% win rate`} />}
            </>
          ) : (
            <>
              <Stat label="Open briefs" value={pool.length} />
              <Stat label="My briefs" value={myProposals.filter((p) => p.stage !== "done").length} />
              <Stat label="With the bots" value={myProposals.filter((p) => /queued|running|awaiting/.test(p.stage)).length} />
              <Stat label="Delivered" value={myProposals.filter((p) => p.stage === "done").length} />
            </>
          )}
        </div>
      </header>

      <div className="rise mt-6 grid gap-5 [animation-delay:80ms] lg:grid-cols-[minmax(300px,1fr)_2.3fr]">
        {/* Left: what needs doing */}
        <Panel
          title="Needs your attention"
          sub={waiting ? `${waiting} thing${waiting === 1 ? "" : "s"}, most urgent first` : "Nothing waiting"}
          action={
            canCreateLead(me) ? (
              <CornerLink href="/leads/new" icon="plus" label="New lead" />
            ) : strategist ? (
              <CornerLink href="/briefs" label="Briefs" />
            ) : null
          }
        >
          {canSeeLeads(me) && (
            <form action="/leads" className="relative mb-4">
              <input type="hidden" name="view" value="list" />
              <input name="q" placeholder="Search leads" className="field rounded-full py-3 pr-14 shadow-[inset_0_1px_2px_rgb(23_22_29/0.05)]" />
              <button aria-label="Search" className="absolute right-1.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full solid">
                <Icon name="search" size={15} />
              </button>
            </form>
          )}
          <AttentionCards items={actions.slice(0, 5)} />
        </Panel>

        {/* Right: the big picture */}
        <div className="flex min-w-0 flex-col gap-5">
          {topRight}
          {bottomRight.length > 0 && <div className={`grid gap-5 ${bottomRight.length > 1 ? "xl:grid-cols-2" : ""}`}>{bottomRight.map((el, i) => <Fragment key={i}>{el}</Fragment>)}</div>}
        </div>
      </div>

      {lowerRow.length > 0 && (
        <div className={`rise mt-5 grid gap-5 [animation-delay:160ms] ${lowerRow.length === 3 ? "lg:grid-cols-3" : ""}`}>{lowerRow.map((el, i) => <Fragment key={i}>{el}</Fragment>)}</div>
      )}
    </div>
  );
}
