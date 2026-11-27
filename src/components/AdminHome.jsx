// Admin / ops home (layout "B"): three numbers, then two columns.
//   Left  — Needs you (one to-do list), work to check, late work
//   Right — meetings, client calls, leads at a glance, who has how much work, groups
// The sales head (salesOnly) gets the same screen about their team's leads.
import Link from "next/link";
import { TaskLine } from "@/components/Desk";
import { Block, Counts, HomeHeader, Row, SeeAll, TeamLoad, TwoCol } from "@/components/Home";
import { CLOSED_STATUSES, OPEN_TASK, PROPOSAL_STAGES } from "@/lib/constants";
import { ago, fullName } from "@/lib/format";

const DAY = 864e5;
const IST = "Asia/Kolkata";
const brandOf = (l) => l.brand || fullName(l);
const dayKey = (d) => new Date(d).toLocaleDateString("en-CA", { timeZone: IST });
const time = new Intl.DateTimeFormat("en-IN", { timeZone: IST, hour: "numeric", minute: "2-digit" });
const shortDay = new Intl.DateTimeFormat("en-IN", { timeZone: IST, weekday: "short", day: "numeric", month: "short" });

/** Discovery / proposal calls with leads in the next week, soonest first. */
export function ClientCalls({ upcoming, now, title = "Client calls" }) {
  const soon = upcoming.filter((m) => new Date(m.starts_at).getTime() < now + 7 * DAY).slice(0, 5);
  if (!soon.length) return null;
  const today = dayKey(now);
  const tomorrow = dayKey(now + DAY);
  return (
    <Block title={title} count={soon.length}>
      <ul className="mt-1">
        {soon.map((m) => {
          const k = dayKey(m.starts_at);
          const day = k === today ? "Today" : k === tomorrow ? "Tomorrow" : shortDay.format(new Date(m.starts_at));
          return (
            <Row
              key={m.id}
              href={`/leads/${m.lead.id}`}
              icon="video"
              tone={k === today ? "amber" : undefined}
              title={brandOf(m.lead)}
              sub={`${m.kind === "proposal" ? "Proposal meeting" : "Discovery call"}${m.organizer ? ` · ${m.organizer.name.split(" ")[0]}` : ""}`}
              right={<span className="shrink-0 text-[12px] text-muted">{`${day}, ${time.format(new Date(m.starts_at))}`}</span>}
            />
          );
        })}
      </ul>
    </Block>
  );
}

/**
 *   data      dashboardData(me): leads, upcoming, proposals, members, now
 *   brands    listBrands()
 *   tasks     every task (empty for the sales head)
 *   actions   buttons for the header (New task)
 *   side      extra cards for the top of the right column (team meetings, groups)
 */
export default function AdminHome({ me, data, brands = [], tasks = [], actions, salesOnly = false, side = null }) {
  const { leads, upcoming, proposals, members, now } = data;
  const d0 = new Date(now);
  const monthStart = new Date(d0.getFullYear(), d0.getMonth(), 1).getTime();
  const at = (l) => new Date(l.created_at).getTime();

  // Leads
  const open = leads.filter((l) => !CLOSED_STATUSES.includes(l.status));
  const newWeek = leads.filter((l) => now - at(l) < 7 * DAY);
  const unassigned = open.filter((l) => !l.assigned_to);
  const wonMonth = leads.filter((l) => l.status === "Won" && new Date(l.updated_at).getTime() >= monthStart);
  const stale = open.filter((l) => now - new Date(l.updated_at).getTime() > 5 * DAY);

  // Proposals, clients, work
  const deckReview = proposals.filter((p) => p.stage === "proposal_review");
  const commercials = proposals.filter((p) => p.stage === "awaiting_commercials");
  const failed = proposals.filter((p) => PROPOSAL_STAGES[p.stage]?.error);
  const mouOut = brands.filter((b) => b.stage === "mou_sent");
  const mouDraft = brands.filter((b) => b.stage === "mou_draft");
  const inWork = tasks.filter((t) => OPEN_TASK.includes(t.status));
  const late = inWork.filter((t) => t.due_at && new Date(t.due_at).getTime() < now).sort((a, b) => a.due_at.localeCompare(b.due_at));
  const toCheck = tasks.filter((t) => ["completed", "client_rejected"].includes(t.status) && !t.with_lead);

  // Needs you — one list, most urgent first (tasks have their own cards below)
  const todo = [];
  for (const p of failed) todo.push({ key: `f${p.id}`, icon: "alert", tone: "red", href: `/leads/${p.lead.id}#proposal`, title: `${PROPOSAL_STAGES[p.stage].label} — ${brandOf(p.lead)}`, sub: "Open it and try again" });
  for (const p of deckReview) todo.push({ key: `r${p.id}`, icon: "file", href: `/leads/${p.lead.id}#proposal`, title: `Review the deck for ${brandOf(p.lead)}`, sub: `Version ${p.revision || 1} is ready` });
  for (const p of commercials) todo.push({ key: `c${p.id}`, icon: "rupee", href: `/leads/${p.lead.id}#proposal`, title: `Add pricing for ${brandOf(p.lead)}`, sub: "The deck is waiting on it" });
  if (unassigned.length)
    todo.push({
      key: "u",
      icon: "team",
      tone: "amber",
      href: "/leads?view=list&owner=unassigned",
      title: unassigned.length === 1 ? `Give ${brandOf(unassigned[0])} to someone` : `Give ${unassigned.length} new leads to someone`,
      sub: unassigned.slice(0, 3).map(brandOf).join(", "),
    });
  if (!salesOnly) {
    for (const b of mouDraft) todo.push({ key: `m${b.id}`, icon: "file", href: `/leads/${b.lead?.id || ""}#onboarding`, title: `Send the MOU to ${b.name}`, sub: "They said yes — the MOU is still a draft" });
    for (const b of mouOut.filter((b) => b.mou_sent_at && now - new Date(b.mou_sent_at).getTime() > 3 * DAY))
      todo.push({ key: `s${b.id}`, icon: "clock", href: `/leads/${b.lead?.id || ""}#onboarding`, title: `Follow up on ${b.name}'s MOU`, sub: `Sent ${ago(b.mou_sent_at)}` });
  } else {
    for (const l of stale.slice(0, 6)) todo.push({ key: `l${l.id}`, icon: "clock", href: `/leads/${l.id}`, title: `Follow up with ${brandOf(l)}`, sub: `${l.status} · no update for ${ago(l.updated_at).replace(" ago", "")}` });
  }

  // Who has how much
  const team = salesOnly
    ? members.filter((m) => m.groups?.some((g) => g.kind === "sales")).map((m) => ({ id: m.id, name: m.name, open: open.filter((l) => l.assigned_to === m.id).length, late: 0 }))
    : Object.values(
        inWork.reduce((acc, t) => {
          if (!t.assignee) return acc;
          const p = (acc[t.assignee.id] ||= { id: t.assignee.id, name: t.assignee.name, open: 0, late: 0 });
          p.open += 1;
          if (late.includes(t)) p.late += 1;
          return acc;
        }, {})
      );
  team.sort((a, b) => b.late - a.late || b.open - a.open);

  const counts = salesOnly
    ? [
        { label: "Needs you", value: todo.length, tone: "red" },
        { label: "Open leads", value: open.length, href: "/leads" },
        { label: "New this week", value: newWeek.length, href: "/leads?view=list" },
      ]
    : [
        { label: "Needs you", value: todo.length + toCheck.length, tone: "red" },
        { label: "Late tasks", value: late.length, tone: "red", href: "/tasks?show=late" },
        { label: "New leads this week", value: newWeek.length, href: "/leads?view=list" },
      ];

  return (
    <div className="page">
      <HomeHeader name={me.name} sub={salesOnly ? "Sales" : `${members.length} people in the team`} actions={actions} />
      <Counts items={counts} />
      <TwoCol
        main={
          <>
            <div id="needs" className="scroll-mt-6">
              <Block title="Needs you" count={todo.length} empty={toCheck.length ? undefined : "Nothing needs you right now."}>
                <ul className="mt-1">
                  {todo.map((it) => (
                    <Row key={it.key} href={it.href} icon={it.icon} tone={it.tone} title={it.title} sub={it.sub} />
                  ))}
                </ul>
              </Block>
            </div>
            {!salesOnly && (
              <Block title="To check" count={toCheck.length} action={<SeeAll href="/tasks" />}>
                <ul className="mt-1">
                  {toCheck.slice(0, 6).map((t) => (
                    <TaskLine key={t.id} t={t} />
                  ))}
                </ul>
              </Block>
            )}
            {!salesOnly && (
              <div id="late" className="scroll-mt-6">
                <Block title="Late" count={late.length} action={<SeeAll href="/tasks" />}>
                  <ul className="mt-1">
                    {late.slice(0, 8).map((t) => (
                      <TaskLine key={t.id} t={t} />
                    ))}
                  </ul>
                </Block>
              </div>
            )}
          </>
        }
        side={
          <>
            {side}
            <ClientCalls upcoming={upcoming} now={now} />
            <Block title={salesOnly ? "Your team's leads" : "Leads"} action={<SeeAll href="/leads">Pipeline</SeeAll>}>
              <dl className="mt-2 grid grid-cols-3 gap-2 text-center">
                {[
                  ["Open", open.length],
                  ["This week", newWeek.length],
                  ["Won this month", wonMonth.length],
                ].map(([l, v]) => (
                  <div key={l} className="rounded-xl bg-panel-2 px-2 py-2.5">
                    <dd className="text-[20px] font-medium tabular-nums">{v}</dd>
                    <dt className="text-[11px] text-muted">{l}</dt>
                  </div>
                ))}
              </dl>
              {stale.length > 0 && !salesOnly && (
                <Link href="/leads?view=list" className="mt-3 block text-[12px] text-amber-500 hover:underline">
                  {stale.length} open lead{stale.length > 1 ? "s have" : " has"} had no update for 5+ days
                </Link>
              )}
            </Block>
            <TeamLoad people={team.slice(0, 8)} title={salesOnly ? "Leads per person" : "Who has how much"} href={salesOnly ? "/leads?view=list" : "/tasks"} />
          </>
        }
      />
    </div>
  );
}
