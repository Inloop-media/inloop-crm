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
import { Block, HomeHeader } from "@/components/Home";
import { canSeeAllLeads, canSeeLeads, headsTeam, isExecHead, isSalesHead, isStrategist, myTeam, salesTeam } from "@/lib/permissions";
import TeamMeetings from "@/components/TeamMeetings";
import { canCallMeetings, meetingAudience, myTeamMeetings } from "@/lib/teamMeetings";
import { listGroups } from "@/lib/leads";
import { ownHeadIds, runsGroup, sortGroups, teamLeadIdsOf } from "@/lib/groups";

/** Every group this person is in or runs (one person can be in several), with their role there. */
async function MyGroups({ me }) {
  const all = await listGroups();
  const mine = sortGroups(all.filter((g) => g.members.some((m) => m.id === me.id) || teamLeadIdsOf(g).includes(me.id) || runsGroup(g, me.id)));
  if (!mine.length) return null;
  return (
    <Block title="Your groups" count={mine.length}>
      <ul className="mt-1">
        {mine.map((g) => {
          const role = teamLeadIdsOf(g).includes(me.id) ? "Team lead" : runsGroup(g, me.id) ? (g.kind !== "execution" && ownHeadIds(g).includes(me.id) ? "Manager" : "CBO") : "Member";
          const people = g.members.filter((m) => m.active).length;
          return (
            <li key={g.id} className="border-b border-line last:border-0">
              <Link href={runsGroup(g, me.id) || me.role === "admin" ? `/groups/${g.id}` : "/groups"} className="group flex items-center gap-3 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium group-hover:text-brand">{g.name}</span>
                  <span className="block text-[11px] text-muted">
                    {people} {people === 1 ? "person" : "people"}
                  </span>
                </span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${role === "Member" ? "bg-panel-2 text-muted" : "bg-brand/10 text-brand"}`}>{role}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </Block>
  );
}

/** The top of the right column on every dashboard: team meetings, then the groups you're in. */
function Side({ me }) {
  return (
    <>
      <Meetings me={me} />
      <MyGroups me={me} />
    </>
  );
}

/** The team meetings card for any dashboard: what you're in, and "Schedule meeting" for team leads and up. */
async function Meetings({ me }) {
  const [meetings, audience] = await Promise.all([myTeamMeetings(me.id).catch(() => []), canCallMeetings(me) ? meetingAudience(me) : null]);
  return (
    <TeamMeetings
      meetings={meetings}
      audience={audience}
      connected={Boolean(me.calendar_connected_at)}
      domain={process.env.ALLOWED_DOMAIN}
      now={nowMs()}
    />
  );
}

export const metadata = { title: "Dashboard" };

const nowMs = () => Date.now();

/** Execution heads (Udit, Krish): their teams' work — what to check, what's late, how each brand is doing. */
async function ExecDashboard({ me }) {
  const [allTasks, allPeople, brands] = await Promise.all([listTasks(me, { view: "all" }), listMakers(me), listBrands()]);
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
      <HomeHeader
        name={me.name}
        sub={scoped ? (me.ledGroups || []).map((g) => g.name).join(", ") : ""}
        actions={
          <>
            <Link href="/calendar" className="btn-ghost btn-sm">
              <Icon name="calendar" size={13} /> Content calendar
            </Link>
            <QuickAssign brands={active} people={people} label="New task" />
          </>
        }
      />
      <HeadHome tasks={tasks} brands={theirBrands} files={files} side={<Side me={me} />} />
    </div>
  );
}

/** Sales head (Arushi): the sales dashboard, about their own team's leads. */
async function SalesHeadDashboard({ me }) {
  const data = await dashboardData(me);
  const team = [me.id, ...salesTeam(me)];
  return <AdminHome me={me} data={{ ...data, members: data.members.filter((m) => team.includes(m.id)) }} brands={[]} tasks={[]} salesOnly side={<Side me={me} />} />;
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
        side={<Side me={me} />}
      />
    );
  }

  // Everyone else: the admin look, about their own work (tasks, leads and/or briefs — whatever they do)
  const [data, tasks, followUps] = await Promise.all([dashboardData(me), listTasks(me, { view: "mine" }), myFollowUps(me)]);
  return <UserHome me={me} data={data} tasks={tasks} followUps={followUps} side={<Side me={me} />} sub={(me.groups || []).map((g) => g.name).join(", ")} />;
}
