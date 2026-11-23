// Home for everyone who isn't admin / ops / a head (layout "B"): three numbers about their main job,
// then two columns — their own work on the left, meetings / groups / calls on the right.
// Only the parts of the job they actually do show up:
//   maker (designer / editor / developer) → their tasks
//   sales executive with leads            → follow-ups and their pipeline
//   strategist with briefs                → open briefs and their proposals
import Link from "next/link";
import MyWork from "@/components/MyWork";
import { ClientCalls } from "@/components/AdminHome";
import { ProposalProgress } from "@/components/DashboardView";
import { Block, Counts, HomeHeader, Row, SeeAll, TwoCol } from "@/components/Home";
import { Empty } from "@/components/ui";
import { CLOSED_STATUSES, OPEN_TASK } from "@/lib/constants";
import { ago, fullName } from "@/lib/format";
import { isMaker, isSales, isStrategist } from "@/lib/permissions";

const DAY = 864e5;
const IST = "Asia/Kolkata";
const brandOf = (l) => l.brand || fullName(l);
const dayKey = (d) => new Date(d).toLocaleDateString("en-CA", { timeZone: IST });
const clock = new Intl.DateTimeFormat("en-IN", { timeZone: IST, hour: "numeric", minute: "2-digit" });

const STAGES = [
  ["New", ["New Lead"]],
  ["Touchbase", ["First Call / Touchbase", "Follow-up Scheduled", "DNP"]],
  ["Discovery", ["Discovery Call"]],
  ["Proposal", ["Proposal Meeting Scheduled"]],
  ["Negotiation", ["Negotiation", "Waiting Client Decision"]],
];

/**
 *   data   dashboardData(me) — leads, upcoming, proposals, now
 *   tasks  this person's tasks
 *   side   cards for the top of the right column (team meetings, groups)
 */
export default function UserHome({ me, data, tasks = [], followUps = [], side = null, sub = "" }) {
  const { leads, upcoming, proposals, now } = data;
  const today = dayKey(now);
  const isLate = (t) => OPEN_TASK.includes(t.status) && t.due_at && new Date(t.due_at).getTime() < now;

  // ---- Tasks (makers) ----
  const openTasks = tasks.filter((t) => OPEN_TASK.includes(t.status));
  const lateTasks = openTasks.filter(isLate);
  const doToday = openTasks.filter((t) => t.status === "revision" || isLate(t) || (t.due_at && dayKey(t.due_at) === today));
  const waiting = tasks.filter((t) => ["completed", "ready", "client_rejected", "sent_to_client"].includes(t.status));
  const doesTasks = isMaker(me) || tasks.length > 0;

  // ---- Leads (sales) ----
  const openLeads = leads.filter((l) => !CLOSED_STATUSES.includes(l.status));
  const newWeek = leads.filter((l) => now - new Date(l.created_at).getTime() < 7 * DAY);
  const stale = openLeads.filter((l) => now - new Date(l.updated_at).getTime() > (l.status === "New Lead" ? 2 : 5) * DAY).sort((a, b) => new Date(a.updated_at) - new Date(b.updated_at));
  const doesSales = isSales(me) && (openLeads.length > 0 || newWeek.length > 0);

  // ---- Briefs (strategists) ----
  const pool = proposals.filter((p) => !p.strategist_id);
  const mine = proposals.filter((p) => p.strategist_id === me.id);
  const delivered = mine.filter((p) => p.stage === "done");
  const needsDocs = mine.filter((p) => ["picked_up", "crl_failed"].includes(p.stage));
  const doesBriefs = isStrategist(me) && (mine.length > 0 || pool.length > 0);

  const main = doesTasks && (tasks.length || !doesSales) ? "tasks" : doesSales ? "sales" : doesBriefs ? "briefs" : "tasks";

  // Everything that isn't a task, as one to-do list
  const todo = [
    ...followUps.map((l) => ({
      key: `f${l.id}`,
      icon: "bell",
      tone: new Date(l.follow_up_at).getTime() < now ? "red" : "amber",
      href: `/leads/${l.id}`,
      title: `Call ${brandOf(l)}`,
      sub: `${new Date(l.follow_up_at).getTime() < now ? "Follow-up due" : `Follow up at ${clock.format(new Date(l.follow_up_at))}`}${l.follow_up_note ? ` · ${l.follow_up_note}` : ""}`,
    })),
    ...(doesSales ? stale.filter((l) => !followUps.some((f) => f.id === l.id)).slice(0, 6).map((l) => ({ key: `l${l.id}`, icon: "clock", href: `/leads/${l.id}`, title: `Follow up with ${brandOf(l)}`, sub: `${l.status} · no update for ${ago(l.updated_at).replace(" ago", "")}` })) : []),
    ...(doesBriefs
      ? [
          ...pool.map((p) => ({ key: `b${p.id}`, icon: "brief", tone: "amber", href: `/briefs/${p.lead.id}`, title: `New brief — ${brandOf(p.lead)}`, sub: `Shared ${ago(p.shared_at)} · pick it up` })),
          ...needsDocs.map((p) => ({ key: `d${p.id}`, icon: "upload", href: `/briefs/${p.lead.id}`, title: `Upload documents — ${brandOf(p.lead)}`, sub: "References, creatives, strategy, identity" })),
        ]
      : []),
  ];

  const counts = {
    tasks: [
      { label: "Do today", value: doToday.length, tone: "red", href: "/tasks" },
      { label: "Late", value: lateTasks.length, tone: "red", href: "/tasks" },
      { label: "Waiting on others", value: waiting.length, href: "/tasks" },
    ],
    sales: [
      { label: "Follow up", value: followUps.length + stale.length, tone: "amber", href: "/leads?view=list" },
      { label: "Open leads", value: openLeads.length, href: "/leads" },
      { label: "New this week", value: newWeek.length, href: "/leads?view=list" },
    ],
    briefs: [
      { label: "Open briefs", value: pool.length, tone: "amber", href: "/briefs" },
      { label: "Need documents", value: needsDocs.length, href: "/briefs?tab=mine" },
      { label: "Delivered", value: delivered.length, href: "/briefs?tab=done" },
    ],
  }[main];

  const pipeline = doesSales && (
    <Block key="pipe" title="My pipeline" action={<SeeAll href="/leads">Board</SeeAll>}>
      <ul className="mt-1">
        {STAGES.map(([label, st]) => {
          const n = openLeads.filter((l) => st.includes(l.status)).length;
          return (
            <li key={label} className="border-b border-line last:border-0">
              <Link href={`/leads?view=list&status=${encodeURIComponent(st[0])}`} className="group flex items-center justify-between py-2.5 text-[13px]">
                <span className="group-hover:text-brand">{label}</span>
                <span className={`tabular-nums ${n ? "text-ink" : "text-faint"}`}>{n}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </Block>
  );
  const briefsCard = doesBriefs && (
    <Block key="briefs" title="My proposals" action={<SeeAll href="/briefs">Briefs</SeeAll>}>
      <div className="mt-2">
        <ProposalProgress proposals={[...mine, ...pool]} hrefFor={(p) => `/briefs/${p.lead.id}`} />
      </div>
    </Block>
  );

  return (
    <div className="page">
      <HomeHeader name={me.name} sub={sub} />
      <Counts items={counts} />
      <TwoCol
        main={
          <>
            <Block title={main === "tasks" ? "Also to do" : "To do"} count={todo.length} empty={main === "tasks" ? undefined : "All clear for today."}>
              <ul className="mt-1">
                {todo.map((it) => (
                  <Row key={it.key} href={it.href} icon={it.icon} tone={it.tone} title={it.title} sub={it.sub} />
                ))}
              </ul>
            </Block>
            {doesTasks &&
              (tasks.length ? (
                <MyWork me={me} tasks={tasks} embedded />
              ) : (
                <div className="card">
                  <Empty icon="tasks">No tasks yet. When someone gives you work, it shows up here and on your phone.</Empty>
                </div>
              ))}
            {main === "briefs" && briefsCard}
          </>
        }
        side={
          <>
            {side}
            <ClientCalls upcoming={upcoming} now={now} title="Your calls" />
            {pipeline}
            {main !== "briefs" && briefsCard}
          </>
        }
      />
    </div>
  );
}
