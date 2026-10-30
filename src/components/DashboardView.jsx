import Link from "next/link";
import DailyChart from "@/components/DailyChart";
import Icon from "@/components/Icon";
import StatusBadge from "@/components/StatusBadge";
import { describe } from "@/components/Timeline";
import { Avatar, Empty, Panel, StagePill, Stat, StepTrack } from "@/components/ui";
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

function ActionList({ items }) {
  if (!items.length) return <Empty>You&apos;re all caught up.</Empty>;
  return (
    <ul className="-mx-2 flex flex-col">
      {items.map((it) => (
        <li key={it.key}>
          <Link href={it.href} className="group flex items-center gap-3.5 rounded-2xl px-2 py-2.5 transition hover:bg-white/[0.035]">
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl border ${it.tone}`}>
              <Icon name={it.icon} size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{it.title}</div>
              <div className="truncate text-xs text-muted">{it.sub}</div>
            </div>
            <span className="hidden shrink-0 rounded-md bg-panel-2 px-1.5 py-0.5 text-[11px] tabular-nums text-muted sm:block">{it.code}</span>
            <Icon name="arrow" size={14} className="shrink-0 text-faint transition group-hover:translate-x-0.5 group-hover:text-ink" />
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
  const groups = [];
  for (const m of meetings.slice(0, 8)) {
    const k = dayKey(m.starts_at);
    const label = k === today ? "Today" : k === tomorrow ? "Tomorrow" : shortDay.format(new Date(m.starts_at));
    const g = groups.at(-1);
    if (g && g.label === label) g.items.push(m);
    else groups.push({ label, items: [m] });
  }
  return (
    <div className="flex flex-col gap-4">
      {groups.map((g) => (
        <div key={g.label}>
          <div className="eyebrow mb-1.5">{g.label}</div>
          <ul className="-mx-2">
            {g.items.map((m) => (
              <li key={m.id}>
                <Link href={`/leads/${m.lead.id}`} className="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-white/[0.035]">
                  <span className="w-[62px] shrink-0 text-xs tabular-nums text-ink/80">{timeOnly.format(new Date(m.starts_at))}</span>
                  <span className="h-7 w-[3px] shrink-0 rounded-full" style={{ background: MEETING_KINDS[m.kind].color }} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm">{brandOf(m.lead)}</div>
                    <div className="truncate text-xs text-muted">
                      {MEETING_KINDS[m.kind].label} · {m.organizer?.name || "—"}
                    </div>
                  </div>
                  {m.meet_link && <Icon name="video" size={14} className="shrink-0 text-faint" />}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function Activity({ events }) {
  if (!events.length) return <Empty icon="clock">No activity yet.</Empty>;
  return (
    <ol className="flex flex-col gap-4">
      {events.slice(0, 9).map((e) => (
        <li key={e.id} className="flex gap-3">
          {e.actor?.name ? (
            <Avatar name={e.actor.name} size={26} />
          ) : (
            <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full bg-brand/15 text-brand ring-2 ring-bg">
              <Icon name="sparkle" size={12} />
            </span>
          )}
          <div className="min-w-0 flex-1 text-xs">
            <div className="text-muted">
              <Link href={`/leads/${e.lead.id}`} className="font-medium text-ink hover:text-brand">
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
    <ul className="flex flex-col gap-0.5">
      {STATUSES.map((s) => (
        <li key={s.name}>
          <Link
            href={`/leads?view=list&status=${encodeURIComponent(s.name)}`}
            title={`${s.name}: ${by[s.name]}`}
            className="group grid grid-cols-[minmax(0,180px)_1fr_28px] items-center gap-3 rounded-lg px-1.5 py-1.5 transition hover:bg-white/[0.035]"
          >
            <span className="flex min-w-0 items-center gap-2 text-xs text-ink/80">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: s.color }} />
              <span className="truncate">{s.name}</span>
            </span>
            <span className="h-1.5 overflow-hidden rounded-full bg-ink/[0.04]">
              <span
                className="block h-full rounded-full bg-gradient-to-r from-brand/50 to-brand transition group-hover:brightness-125"
                style={{ width: by[s.name] ? `${Math.max(3, (by[s.name] / max) * 100)}%` : 0 }}
              />
            </span>
            <span className="text-right text-xs tabular-nums text-muted">{by[s.name]}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Proposal pipeline: how many briefs sit at each step + the live ones with their progress. */
function ProposalBoard({ proposals, hrefFor }) {
  const live = proposals.filter((p) => p.stage !== "done");
  const steps = [
    { label: "Brief", stages: ["brief_shared"] },
    { label: "Docs", stages: ["picked_up"] },
    { label: "CRL", stages: ["crl_queued", "crl_running", "crl_failed"] },
    { label: "Commercials", stages: ["awaiting_commercials"] },
    { label: "Building", stages: ["proposal_queued", "proposal_running", "proposal_failed"] },
    { label: "Ready", stages: ["done"] },
  ];
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {steps.map((s) => {
          const n = proposals.filter((p) => s.stages.includes(p.stage)).length;
          const hot = s.label === "Commercials" && n > 0;
          return (
            <div key={s.label} className={`relative overflow-hidden rounded-2xl border px-3.5 py-3 ${hot ? "border-amber-400/30 bg-gradient-to-b from-amber-400/[0.12] to-amber-400/[0.02]" : "border-white/[0.06] bg-gradient-to-b from-white/[0.04] to-transparent"}`}>
              <div className={`num text-[32px] leading-none ${hot ? "text-amber-200" : n ? "" : "text-faint"}`}>{n}</div>
              <div className="mt-1.5 truncate text-[11px] text-muted">{s.label}</div>
            </div>
          );
        })}
      </div>
      {live.length ? (
        <ul className="-mx-2 flex flex-col">
          {live.slice(0, 6).map((p) => (
            <li key={p.id}>
              <Link href={hrefFor(p)} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-2 rounded-xl px-2 py-2.5 transition hover:bg-white/[0.035] sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_136px]">
                <div className="min-w-0">
                  <div className="truncate text-sm">{brandOf(p.lead)}</div>
                  <div className="truncate text-xs text-muted">
                    {p.lead.code} · {p.strategist?.name || "Not picked up"}
                  </div>
                </div>
                <div className="order-last col-span-2 sm:order-none sm:col-span-1">
                  <StepTrack stage={p.stage} compact />
                </div>
                <span className="flex justify-end">
                  <StagePill stage={p.stage} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <Empty icon="sparkle">No proposals in progress.</Empty>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

/** The dashboard for one member — admin / ops, sales executive or creative strategist. */
export default function DashboardView({ me, data }) {
  const staff = canSeeAllLeads(me);
  const sales = !staff && canSeeLeads(me);
  const strategist = !staff && isStrategist(me);
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
  const spark14 = perDay(leads, now, 14).map((d) => d.count);

  // Things that need someone to act
  const actions = [];
  if (staff) {
    for (const p of proposals.filter((p) => p.stage === "awaiting_commercials"))
      actions.push({ key: `c${p.id}`, href: `/leads/${p.lead.id}#proposal`, icon: "rupee", tone: "border-amber-400/30 bg-amber-400/10 text-amber-300", title: `Enter commercials — ${brandOf(p.lead)}`, sub: "CRL is ready. The proposal bot waits for the commercials.", code: p.lead.code });
    for (const p of proposals.filter((p) => PROPOSAL_STAGES[p.stage]?.error))
      actions.push({ key: `f${p.id}`, href: `/leads/${p.lead.id}#proposal`, icon: "alert", tone: "border-rose-400/30 bg-rose-400/10 text-rose-300", title: `${PROPOSAL_STAGES[p.stage].label} — ${brandOf(p.lead)}`, sub: p.error || "Open to retry", code: p.lead.code });
    for (const l of leads.filter((l) => !l.assigned_to).slice(0, 5))
      actions.push({ key: `u${l.id}`, href: `/leads/${l.id}`, icon: "team", tone: "border-brand/30 bg-brand/10 text-brand", title: `Assign ${brandOf(l)}`, sub: `New lead · came in ${ago(l.created_at)}`, code: l.code });
  }
  if (staff || sales) {
    const stale = open
      .filter((l) => l.assigned_to && now - new Date(l.updated_at).getTime() > (l.status === "New Lead" ? 2 : 5) * DAY)
      .sort((a, b) => new Date(a.updated_at) - new Date(b.updated_at))
      .slice(0, 5);
    for (const l of stale)
      actions.push({ key: `s${l.id}`, href: `/leads/${l.id}`, icon: "clock", tone: "border-line bg-panel-2 text-muted", title: `Follow up with ${brandOf(l)}`, sub: `${l.status} · no update for ${ago(l.updated_at).replace(" ago", "")}`, code: l.code });
  }
  if (strategist) {
    for (const p of proposals.filter((p) => !p.strategist_id))
      actions.push({ key: `b${p.id}`, href: `/briefs/${p.lead.id}`, icon: "brief", tone: "border-brand/30 bg-brand/10 text-brand", title: `New brief — ${brandOf(p.lead)}`, sub: `${p.lead.service || "Service not set"} · shared ${ago(p.shared_at)}`, code: p.lead.code });
    for (const p of proposals.filter((p) => p.strategist_id === me.id && ["picked_up", "crl_failed"].includes(p.stage)))
      actions.push({ key: `d${p.id}`, href: `/briefs/${p.lead.id}`, icon: "upload", tone: "border-amber-400/30 bg-amber-400/10 text-amber-300", title: `Upload documents — ${brandOf(p.lead)}`, sub: p.stage === "crl_failed" ? "CRL bot failed — check the documents" : "Reference links, creatives, strategy, identity", code: p.lead.code });
  }

  // Team leaderboard (admin / ops)
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
        .sort((a, b) => b.won - a.won || b.assigned - a.assigned)
    : [];
  const teamMax = Math.max(1, ...team.map((m) => m.assigned));

  const myProposals = proposals.filter((p) => p.strategist_id === me.id);
  const pool = proposals.filter((p) => !p.strategist_id);
  const firstName = me.name.split(" ")[0];
  const waiting = actions.length;

  return (
    <div className="page max-w-[1320px]">
      {/* Header — open, editorial, no box */}
      <header className="rise relative mb-8 flex flex-wrap items-end justify-between gap-6 pt-2 md:mb-10 md:pt-4">
        <div className="min-w-0">
          <p className="eyebrow flex items-center gap-2">
            <span className="h-px w-6 bg-gradient-to-r from-transparent to-brand" />
            {weekday.format(new Date(now))}
          </p>
          <h1 className="mt-4 font-serif text-[44px] font-normal leading-[0.95] tracking-[-0.01em] md:text-[76px]">
            {greeting()},<br className="sm:hidden" /> <em className="serif-accent pr-2">{firstName}</em>
          </h1>
          <div className="mt-5 flex flex-wrap gap-2 text-xs">
            <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 ${waiting ? "border-amber-400/25 bg-amber-400/[0.08] text-amber-200" : "border-emerald-400/25 bg-emerald-400/[0.08] text-emerald-200"}`}>
              <span className={`live-dot h-1.5 w-1.5 rounded-full ${waiting ? "bg-amber-400 text-amber-400/60" : "bg-emerald-400 text-emerald-400/60"}`} />
              {waiting ? `${waiting} thing${waiting === 1 ? "" : "s"} waiting on you` : "All caught up"}
            </span>
            {meetingsWeek.length > 0 && (
              <span className="chip px-3 py-1.5 text-xs text-muted">
                <Icon name="calendar" size={12} />
                {meetingsWeek.length} meeting{meetingsWeek.length === 1 ? "" : "s"} this week
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canSeeLeads(me) && (
            <Link href="/leads" className="btn-ghost">
              Pipeline <Icon name="arrow" size={14} />
            </Link>
          )}
          {strategist && (
            <Link href="/briefs" className="btn-ghost">
              Briefs <Icon name="arrow" size={14} />
            </Link>
          )}
          {canCreateLead(me) && (
            <Link href="/leads/new" className="btn-primary">
              <Icon name="plus" size={14} /> New lead
            </Link>
          )}
        </div>
      </header>

      {/* KPIs */}
      <div className="rise grid grid-cols-2 gap-3 [animation-delay:60ms] xl:grid-cols-4">
        {staff || sales ? (
          <>
            <Stat label={staff ? "New leads · 7 days" : "New to me · 7 days"} value={thisWeek} delta={pct(thisWeek, lastWeek)} sub="vs last week" spark={spark14} icon="sparkle" />
            <Stat label={staff ? "Open pipeline" : "My open leads"} value={open.length} sub={`${leads.length} in total`} icon="leads" tone="cyan" />
            <Stat label="Meetings · next 7 days" value={meetingsWeek.length} sub={`${upcoming.length} upcoming`} icon="calendar" tone="amber" />
            <Stat label="Won" value={won.length} sub={winRate == null ? "No closed deals yet" : `${winRate}% win rate`} icon="check" tone="emerald" />
          </>
        ) : (
          <>
            <Stat label="Open briefs" value={pool.length} sub="Waiting to be picked up" icon="brief" />
            <Stat label="My briefs" value={myProposals.filter((p) => p.stage !== "done").length} sub="In progress" icon="upload" tone="cyan" />
            <Stat label="With the bots" value={myProposals.filter((p) => /queued|running|awaiting/.test(p.stage)).length} sub="CRL / commercials / deck" icon="sparkle" tone="amber" />
            <Stat label="Delivered" value={myProposals.filter((p) => p.stage === "done").length} sub="CRL & deck ready" icon="check" tone="emerald" />
          </>
        )}
      </div>

      {/* Actions + agenda */}
      <div className="rise mt-3 grid gap-3 [animation-delay:120ms] lg:grid-cols-[1.45fr_1fr]">
        <Panel title="Needs your attention" sub="Most urgent first" action={waiting ? <span className="chip tabular-nums">{waiting}</span> : null}>
          <ActionList items={actions.slice(0, 8)} />
        </Panel>
        {staff || sales ? (
          <Panel title="Agenda" sub="Upcoming meetings" action={<Icon name="calendar" className="text-faint" />}>
            <MeetingAgenda meetings={upcoming} now={now} />
          </Panel>
        ) : (
          <Panel title="Recent activity">
            <Activity events={activity} />
          </Panel>
        )}
      </div>

      {(staff || strategist) && (
        <div className="rise mt-3 [animation-delay:180ms]">
          <Panel
            title="Proposal pipeline"
            sub="Brief → documents → CRL → commercials → proposal deck"
            action={
              <Link href="/briefs" className="text-xs text-muted hover:text-ink">
                All briefs →
              </Link>
            }
          >
            <ProposalBoard proposals={staff ? proposals : [...myProposals, ...pool]} hrefFor={(p) => (staff ? `/leads/${p.lead.id}#proposal` : `/briefs/${p.lead.id}`)} />
          </Panel>
        </div>
      )}

      {isAdmin(me) && (
        <div className="rise mt-3 grid gap-3 [animation-delay:240ms] lg:grid-cols-[1.45fr_1fr]">
          <Panel title="Leads per day" sub="Last 30 days" bodyClass="flex flex-col">
            <DailyChart days={days30} />
          </Panel>
          <Panel title="Pipeline by stage" sub={`${leads.length} leads`}>
            <PipelineBars leads={leads} />
          </Panel>
        </div>
      )}

      {(staff || sales) && (
        <div className={`rise mt-3 grid gap-3 [animation-delay:300ms] ${staff ? "lg:grid-cols-[1.45fr_1fr]" : ""}`}>
          {staff && (
            <Panel title="Team" sub="Leads, discovery calls (90 days) and wins">
              {team.length ? (
                <ul className="flex flex-col gap-1">
                  {team.map((m, i) => (
                    <li key={m.id}>
                      <Link href={`/leads?owner=${m.id}`} className="grid grid-cols-[16px_minmax(0,1fr)_44px_52px] items-center gap-2.5 rounded-xl px-2 py-2 transition hover:bg-white/[0.035] sm:grid-cols-[20px_minmax(0,1fr)_repeat(3,56px)] sm:gap-3">
                        <span className="text-xs tabular-nums text-faint">{i + 1}</span>
                        <span className="flex min-w-0 items-center gap-2.5">
                          <Avatar name={m.name} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm">{m.name}</span>
                            <span className="mt-1 block h-1 overflow-hidden rounded-full bg-ink/[0.04]">
                              <span className="block h-full rounded-full bg-brand/70" style={{ width: `${(m.assigned / teamMax) * 100}%` }} />
                            </span>
                          </span>
                        </span>
                        <span className="text-right text-xs tabular-nums text-muted" title="Open / assigned">
                          {m.open}/{m.assigned}
                        </span>
                        <span className="hidden text-right text-xs tabular-nums text-muted sm:block" title="Discovery calls">
                          {m.calls} calls
                        </span>
                        <span className="text-right text-xs font-medium tabular-nums text-emerald-300" title="Won">
                          {m.won} won
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty icon="team">Add people to the Sales Executives group under Team.</Empty>
              )}
            </Panel>
          )}
          <Panel title="Recent activity">
            <Activity events={activity} />
          </Panel>
        </div>
      )}

      {sales && leads.length > 0 && (
        <div className="rise mt-3 [animation-delay:360ms]">
          <Panel title="Latest leads" action={<Link href="/leads?view=list" className="text-xs text-muted hover:text-ink">See all →</Link>}>
            <ul className="-mx-2">
              {leads.slice(0, 6).map((l) => (
                <li key={l.id}>
                  <Link href={`/leads/${l.id}`} className="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-white/[0.035]">
                    <span className="w-12 shrink-0 text-xs text-faint">{l.code}</span>
                    <span className="min-w-0 flex-1 truncate text-sm">{brandOf(l)}</span>
                    <StatusBadge status={l.status} />
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      )}
    </div>
  );
}
