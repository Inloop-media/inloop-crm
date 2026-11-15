// Home for sales executives and creative strategists, laid out like the admin dashboard:
//   [ My month (hero)                 ] [ Today      ]
//   [ My pipeline / proposals ] [ red ] [ (agenda)   ]
//   [ Recent activity ] [ Latest leads / briefs ] [ Meetings ]
import Link from "next/link";
import Icon from "@/components/Icon";
import StatusBadge from "@/components/StatusBadge";
import { RoundLink, Ring } from "@/components/AdminHome";
import { Activity, MeetingAgenda, ProposalProgress } from "@/components/DashboardView";
import { BrandMark, Empty } from "@/components/ui";
import { CLOSED_STATUSES, PROPOSAL_STAGES } from "@/lib/constants";
import { ago, fullName } from "@/lib/format";
import { isStrategist } from "@/lib/permissions";

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

/** data: dashboardData(me) — leads, upcoming, meetings, proposals, activity, now */
export default function UserHome({ me, data }) {
  const { leads, upcoming, meetings, proposals, activity, now } = data;
  const strategist = isStrategist(me) && !leads.length;
  const today = dayKey(now);
  const d0 = new Date(now);
  const monthStart = new Date(d0.getFullYear(), d0.getMonth(), 1).getTime();
  const lastMonthStart = new Date(d0.getFullYear(), d0.getMonth() - 1, 1).getTime();
  const at = (l) => new Date(l.created_at).getTime();

  // Sales numbers (my leads)
  const open = leads.filter((l) => !CLOSED_STATUSES.includes(l.status));
  const thisMonth = leads.filter((l) => at(l) >= monthStart);
  const lastMonth = leads.filter((l) => at(l) >= lastMonthStart && at(l) < monthStart);
  const newWeek = leads.filter((l) => now - at(l) < 7 * DAY);
  const won = leads.filter((l) => l.status === "Won");
  const lost = leads.filter((l) => l.status === "Lost");
  const winRate = won.length + lost.length ? Math.round((won.length / (won.length + lost.length)) * 100) : null;
  const stale = open
    .filter((l) => now - new Date(l.updated_at).getTime() > (l.status === "New Lead" ? 2 : 5) * DAY)
    .sort((a, b) => new Date(a.updated_at) - new Date(b.updated_at));
  const target = Math.max(5, Math.ceil(lastMonth.length * 1.2));
  const callsDone = meetings.filter((m) => new Date(m.starts_at).getTime() < now).length;

  // Strategist numbers
  const pool = proposals.filter((p) => !p.strategist_id);
  const mine = proposals.filter((p) => p.strategist_id === me.id);
  const mineLive = mine.filter((p) => p.stage !== "done");
  const delivered = mine.filter((p) => p.stage === "done");
  const withBots = mine.filter((p) => /queued|running|awaiting/.test(p.stage));
  const needsDocs = mine.filter((p) => ["picked_up", "crl_failed"].includes(p.stage));

  // To-do list for the Today card
  const todo = strategist
    ? [
        ...pool.map((p) => ({ key: `b${p.id}`, icon: "brief", href: `/briefs/${p.lead.id}`, title: `New brief — ${brandOf(p.lead)}`, sub: `Shared ${ago(p.shared_at)} · pick it up` })),
        ...needsDocs.map((p) => ({ key: `d${p.id}`, icon: p.stage === "crl_failed" ? "alert" : "upload", href: `/briefs/${p.lead.id}`, title: `Upload documents — ${brandOf(p.lead)}`, sub: p.stage === "crl_failed" ? "The CRL bot failed — check the documents" : "References, creatives, strategy, identity", tone: p.stage === "crl_failed" ? "rose" : "" })),
      ]
    : stale.map((l) => ({ key: l.id, icon: "clock", href: `/leads/${l.id}`, title: `Follow up with ${brandOf(l)}`, sub: `${l.status} · no update for ${ago(l.updated_at).replace(" ago", "")}` }));

  // Week strip
  const monday = new Date(now - ((d0.getDay() + 6) % 7) * DAY);
  const week = Array.from({ length: 7 }, (_, i) => new Date(monday.getTime() + i * DAY));
  const meetingsOn = (k) => upcoming.filter((m) => dayKey(m.starts_at) === k).length;
  const agenda = upcoming.filter((m) => new Date(m.starts_at).getTime() < now + 2 * DAY).slice(0, 3);
  const weekMeetings = upcoming.filter((m) => new Date(m.starts_at).getTime() < week[6].getTime() + DAY).length;

  // My pipeline by stage
  const STAGES = [
    ["New", ["New Lead"]],
    ["Touchbase", ["First Call / Touchbase", "Follow-up Scheduled", "DNP"]],
    ["Discovery", ["Discovery Call"]],
    ["Proposal", ["Proposal Meeting Scheduled"]],
    ["Negotiation", ["Negotiation", "Waiting Client Decision"]],
  ].map(([label, st]) => ({ label, n: open.filter((l) => st.includes(l.status)).length, q: st[0] }));
  const maxStage = Math.max(1, ...STAGES.map((s) => s.n));
  const top = STAGES.reduce((a, b) => (b.n > a.n ? b : a), STAGES[0]);

  return (
    <div className="page">
      <h1 className="rise text-[26px] font-normal tracking-[-0.02em]">
        {greeting()}, {me.name.split(" ")[0]} 👋
      </h1>

      <div className="mt-4 grid gap-4 xl:grid-cols-12">
        {/* Hero */}
        <Card className="rise xl:col-span-8">
          {strategist ? (
            <>
              <p className="text-xs text-muted">Your proposals</p>
              <h2 className="mt-1 text-[26px] font-normal leading-tight tracking-[-0.02em]">
                Make every pitch <span className="text-brand">a win</span>
              </h2>
              <div className="mt-3 flex items-end gap-3">
                <span className="text-[52px] font-normal leading-none tracking-[-0.03em] tabular-nums">{mineLive.length}</span>
                <span className="mb-1.5 text-sm text-muted">briefs in progress</span>
              </div>
              <div className="mt-6 flex h-3 gap-1">
                <span className="rounded-full bg-gradient-to-r from-brand-soft to-brand" style={{ width: `${Math.max(3, mine.length ? (delivered.length / mine.length) * 100 : 0)}%` }} />
                <span className="hatch flex-1 rounded-full" />
              </div>
              <p className="mt-2 text-[11px] text-muted">
                {delivered.length} of {mine.length} delivered
              </p>
            </>
          ) : (
            <>
              <p className="text-xs text-muted">My leads this month · target {target}</p>
              <h2 className="mt-1 text-[26px] font-normal leading-tight tracking-[-0.02em]">
                Close more deals <span className="text-brand">this month</span>
              </h2>
              <div className="mt-3 flex items-end gap-3">
                <span className="text-[52px] font-normal leading-none tracking-[-0.03em] tabular-nums">{thisMonth.length}</span>
                <span className="mb-1.5 text-sm text-muted">new leads assigned</span>
              </div>
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
            </>
          )}
          <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
            {(strategist
              ? [
                  ["brief", "Open briefs", pool.length, pool.length ? "Waiting to be picked up" : "Nothing new", "/briefs"],
                  ["sparkle", "With the bots", withBots.length, "CRL and deck being made", "/briefs?tab=mine"],
                  ["check", "Delivered", delivered.length, "Proposals ready", "/briefs?tab=done"],
                ]
              : [
                  ["leads", "New this week", newWeek.length, `${open.length} open in total`, "/leads"],
                  ["video", "Meetings this week", weekMeetings, `${callsDone} calls done (90 days)`, "/leads?view=list"],
                  ["check", "Won", won.length, winRate === null ? "No deals closed yet" : `${winRate}% win rate`, "/leads?view=list&status=Won"],
                ]
            ).map(([icon, label, value, note, href]) => (
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
            <RoundLink href={strategist ? "/briefs" : "/leads"} icon={strategist ? "brief" : "leads"} label="Open" />
          </div>
          <div className="mt-4 grid grid-cols-7 gap-1.5">
            {week.map((d) => {
              const k = dayKey(d);
              const on = k === today;
              const n = meetingsOn(k);
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
          <div className="mt-auto pt-4">
            <div className="text-[13px] font-medium">This week</div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {strategist ? (
                <>
                  <Ring value={mineLive.length} total={Math.max(mineLive.length, mine.length)} label="In work" icon="brief" />
                  <Ring value={withBots.length} total={Math.max(withBots.length, mineLive.length)} label="Bots" icon="sparkle" />
                  <Ring value={delivered.length} total={Math.max(delivered.length, mine.length)} label="Done" icon="check" />
                </>
              ) : (
                <>
                  <Ring value={newWeek.length} total={Math.max(newWeek.length, Math.ceil(target / 4))} label="Leads" icon="leads" />
                  <Ring value={weekMeetings} total={Math.max(weekMeetings, 5)} label="Meetings" icon="video" />
                  <Ring value={open.length - stale.length} total={Math.max(1, open.length)} label="On track" icon="check" />
                </>
              )}
            </div>
          </div>
        </Card>

        {/* Pipeline / proposals */}
        <Card className="rise flex flex-col xl:col-span-5">
          {strategist ? (
            <>
              <Title title="My proposals" sub="Brief → documents → CRL → commercials → deck" action={<RoundLink href="/briefs" label="Briefs" />} />
              <ProposalProgress proposals={[...mine, ...pool]} hrefFor={(p) => `/briefs/${p.lead.id}`} />
            </>
          ) : (
            <>
              <Title
                title="My pipeline"
                sub={`${open.length} open leads`}
                action={<RoundLink href="/leads" label="Open the board" />}
              />
              <div className="mt-8 flex flex-1 items-end justify-between gap-3">
                {STAGES.map((s) => {
                  const on = s === top && s.n > 0;
                  return (
                    <Link key={s.label} href={`/leads?view=list&status=${encodeURIComponent(s.q)}`} className="group flex flex-1 flex-col items-center gap-2">
                      <span className="relative flex h-32 w-full max-w-[46px] items-end">
                        <span
                          className={`relative w-full rounded-full transition group-hover:brightness-110 ${on ? "bg-gradient-to-b from-brand-soft to-brand shadow-[0_10px_24px_-10px_rgb(225_29_46/0.8)]" : "hatch border border-line-strong bg-panel"}`}
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
            </>
          )}
        </Card>

        {/* The red card */}
        <section className="card-coral rise flex flex-col p-5 xl:col-span-3">
          <div className="flex items-start justify-between">
            <h2 className="text-xl font-normal tracking-[-0.01em]">{strategist ? "Open briefs" : "Follow up"}</h2>
            <RoundLink href={strategist ? "/briefs" : "/leads?view=list"} label="Open" light />
          </div>
          <div className="mt-5 flex items-end gap-2">
            <span className="text-[64px] font-light leading-none tabular-nums">{strategist ? pool.length : stale.length}</span>
            <span className="mb-2 text-xs leading-tight text-white/80">
              {strategist ? (
                <>
                  waiting to be
                  <br />
                  picked up
                </>
              ) : (
                <>
                  of {open.length}
                  <br />
                  open leads
                </>
              )}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-white/75">{strategist ? "Pick one up from Proposals" : "No update for a few days — call them today"}</p>
          <ul className="mt-auto flex flex-col gap-1.5 pt-4 text-[12px]">
            {(strategist ? pool.map((p) => [p.id, brandOf(p.lead), `/briefs/${p.lead.id}`]) : stale.map((l) => [l.id, brandOf(l), `/leads/${l.id}`]))
              .slice(0, 3)
              .map(([id, label, href]) => (
                <li key={id}>
                  <Link href={href} className="flex items-center justify-between rounded-lg bg-white/15 px-2.5 py-1.5 hover:bg-white/25">
                    <span className="truncate">{label}</span>
                    <Icon name="arrow" size={12} />
                  </Link>
                </li>
              ))}
          </ul>
        </section>

        {/* Bottom row */}
        <Card className="rise xl:col-span-4">
          <Title title="Recent activity" sub={strategist ? "Your briefs" : "Across your leads"} />
          <Activity events={activity} />
        </Card>
        <Card className="rise xl:col-span-4">
          {strategist ? (
            <>
              <Title title="Delivered" sub="Proposals you finished" action={<RoundLink href="/briefs?tab=done" label="Delivered" />} />
              {delivered.length ? (
                <ul className="flex flex-col">
                  {delivered.slice(0, 6).map((p) => (
                    <li key={p.id} className="border-b border-line last:border-0">
                      <Link href={`/briefs/${p.lead.id}`} className="flex items-center gap-3 py-2.5 hover:text-brand">
                        <BrandMark name={brandOf(p.lead)} size={30} />
                        <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{brandOf(p.lead)}</span>
                        <span className="text-[11px] text-muted">{PROPOSAL_STAGES[p.stage]?.label}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty icon="check">Nothing delivered yet.</Empty>
              )}
            </>
          ) : (
            <>
              <Title title="Latest leads" sub="Assigned to you" action={<RoundLink href="/leads?view=list" label="All leads" />} />
              {leads.length ? (
                <ul className="flex flex-col">
                  {leads.slice(0, 6).map((l) => (
                    <li key={l.id} className="border-b border-line last:border-0">
                      <Link href={`/leads/${l.id}`} className="flex items-center gap-3 py-2.5">
                        <BrandMark name={brandOf(l)} size={30} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium hover:text-brand">{brandOf(l)}</span>
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
            </>
          )}
        </Card>
        <Card className="rise xl:col-span-4">
          <Title title="Meetings" sub="Coming up" />
          <MeetingAgenda meetings={upcoming} now={now} />
        </Card>
      </div>
    </div>
  );
}
