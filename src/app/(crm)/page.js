import Link from "next/link";
import UserHome from "@/components/UserHome";
import HeadHome from "@/components/HeadHome";
import AdminHome from "@/components/AdminHome";
import Icon from "@/components/Icon";
import { requireMember } from "@/lib/auth";
import { dashboardData, myFollowUps } from "@/lib/leads";
import { listBrands } from "@/lib/brands";
import { listMakers, listTasks, reviewFiles } from "@/lib/tasks";
import QuickAssign from "@/components/QuickAssign";
import { PageTop } from "@/components/Desk";
import { canSeeAllLeads, canSeeLeads, headsTeam, isExecHead, isSalesHead, isStrategist, myTeam, salesTeam } from "@/lib/permissions";
import { Avatar } from "@/components/ui";
import { GROUP_KINDS, OPEN_TASK } from "@/lib/constants";

export const metadata = { title: "Dashboard" };

const IST = { timeZone: "Asia/Kolkata" };
const weekday = new Intl.DateTimeFormat("en-IN", { ...IST, weekday: "long", day: "numeric", month: "long" });
function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-IN", { ...IST, hour: "numeric", hour12: false }).format(new Date()));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

/** The groups a head runs, one card each: who's in it and how their work stands. */
function MyTeams({ me, tasks, members }) {
  const groups = (me.ledGroups || []).filter((g) => g.kind !== "sales" || (me.ledGroups || []).every((x) => x.kind === "sales"));
  if (!groups.length) return null;
  const name = Object.fromEntries(members.map((m) => [m.id, m.name]));
  const now = nowMs();
  return (
    <section className="rise mb-4">
      <h2 className="mb-2 text-[13px] font-medium text-muted">Your teams</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {groups.map((g) => {
          const mine = tasks.filter((t) => g.memberIds.includes(t.assignee_id));
          const open = mine.filter((t) => OPEN_TASK.includes(t.status));
          const late = open.filter((t) => t.due_at && new Date(t.due_at).getTime() < now);
          return (
            <Link key={g.id} href={`/tasks?view=team`} className="card card-hover flex flex-col gap-3 p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-[15px] font-medium">{g.name}</div>
                  <div className="text-[11px] text-muted">{GROUP_KINDS.find((k) => k.id === g.kind)?.label || g.kind}</div>
                </div>
                <span className="flex -space-x-2">
                  {g.memberIds.slice(0, 4).map((id) => (
                    <Avatar key={id} name={name[id] || "?"} size={26} />
                  ))}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted">
                <span>
                  <b className="text-base font-medium text-ink">{g.memberIds.length}</b> people
                </span>
                <span>
                  <b className="text-base font-medium text-ink">{open.length}</b> open
                </span>
                <span className={late.length ? "text-rose-400" : ""}>
                  <b className={`text-base font-medium ${late.length ? "text-rose-400" : "text-ink"}`}>{late.length}</b> late
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
const nowMs = () => Date.now();

/** Execution heads (Udit, Krish): their teams' work — what to check, what's late, how each brand is doing. */
async function ExecDashboard({ me }) {
  const [allTasks, allPeople, brands, data] = await Promise.all([listTasks(me, { view: "all" }), listMakers(me), listBrands(), dashboardData(me)]);
  // A head who runs groups sees their teams' work (and anything they assigned themselves)
  const team = myTeam(me);
  const scoped = headsTeam(me) && team.length;
  const tasks = scoped ? allTasks.filter((t) => team.includes(t.assignee_id) || t.assigned_by === me.id) : allTasks;
  const people = allPeople; // already only the people this head may assign to
  const active = brands.filter((b) => b.stage === "active").map((b) => ({ id: b.id, name: b.name }));
  const theirBrands = scoped ? active.filter((b) => tasks.some((t) => t.brand?.id === b.id)) : active;
  const files = await reviewFiles(tasks);
  return (
    <div className="page">
      <PageTop
        title={`${greeting()}, ${me.name.split(" ")[0]} 👋`}
        sub={scoped ? `${weekday.format(new Date())} · ${(me.ledGroups || []).map((g) => g.name).join(", ")}` : weekday.format(new Date())}
        right={
          <>
            <Link href="/calendar" className="btn-ghost btn-sm">
              <Icon name="calendar" size={13} /> Content calendar
            </Link>
            <QuickAssign brands={active} people={people} label="New task" />
          </>
        }
      />
      <MyTeams me={me} tasks={allTasks} members={data.members} />
      <div className="rise">
        <HeadHome tasks={tasks} brands={theirBrands} files={files} />
      </div>
    </div>
  );
}

/** Sales head (Arushi): the sales dashboard, about their own team's leads. */
async function SalesHeadDashboard({ me }) {
  const data = await dashboardData(me);
  const team = [me.id, ...salesTeam(me)];
  return <AdminHome me={me} data={{ ...data, members: data.members.filter((m) => team.includes(m.id)) }} brands={[]} tasks={[]} salesOnly />;
}

export default async function Dashboard() {
  const me = await requireMember();
  const staff = canSeeAllLeads(me);

  // Heads of departments see their own teams (the admin always sees everything)
  if (me.role !== "admin" && isSalesHead(me)) return <SalesHeadDashboard me={me} />;
  if (me.role !== "admin" && headsTeam(me)) return <ExecDashboard me={me} />;
  // Execution heads who aren't also on sales / strategy get a dashboard about their tasks
  if (isExecHead(me) && !staff && !canSeeLeads(me) && !isStrategist(me)) return <ExecDashboard me={me} />;

  // Admin / ops: what needs them, the agency at a glance, meetings
  if (staff) {
    const [data, tasks, brands, people] = await Promise.all([dashboardData(me), listTasks(me, { view: "all" }), listBrands(), listMakers(me)]);
    const active = brands.filter((b) => b.stage === "active").map((b) => ({ id: b.id, name: b.name }));
    return (
      <AdminHome
        me={me}
        data={data}
        brands={brands}
        tasks={tasks}
        actions={<QuickAssign brands={active} people={people} label="New task" />}
      />
    );
  }

  // Everyone else: the admin look, about their own work (tasks, leads and/or briefs — whatever they do)
  const [data, tasks, followUps] = await Promise.all([dashboardData(me), listTasks(me, { view: "mine" }), myFollowUps(me)]);
  return <UserHome me={me} data={data} tasks={tasks} followUps={followUps} />;
}
