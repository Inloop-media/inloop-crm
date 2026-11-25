import Link from "next/link";
import UserHome from "@/components/UserHome";
import HeadHome from "@/components/HeadHome";
import AdminHome from "@/components/AdminHome";
import AdminOverview from "@/components/AdminOverview";
import BrandMonth from "@/components/BrandMonth";
import { Avatar } from "@/components/ui";
import { GROUP_KINDS } from "@/lib/constants";
import { db } from "@/lib/supabase/server";
import Icon from "@/components/Icon";
import { requireMember } from "@/lib/auth";
import { dashboardData, myFollowUps } from "@/lib/leads";
import { listBrands } from "@/lib/brands";
import { listMakers, listTasks, reviewFiles } from "@/lib/tasks";
import QuickAssign from "@/components/QuickAssign";
import { Block, HomeHeader } from "@/components/Home";
import { canKeepNotes, canSeeAllLeads, canSeeLeads, headsTeam, isExecHead, isOpsHead, isSalesHead, isStrategist, myTeam, salesTeam } from "@/lib/permissions";
import TeamMeetings from "@/components/TeamMeetings";
import MyNotes from "@/components/MyNotes";
import { myNotes } from "@/lib/notes";
import { canCallMeetings, meetingAudience, myTeamMeetings } from "@/lib/teamMeetings";
import { listGroups } from "@/lib/leads";
import { headIdsOf, ownHeadIds, runsGroup, sortGroups, teamLeadIdsOf } from "@/lib/groups";

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

/**
 * Every group this person is in (one person can be in several — e.g. Abhay in Creative Strategists and
 * Development): who manages it, the team lead(s), their own role there and who else is in it.
 * Groups they run already show under "Your teams", so those are left out here.
 */
async function GroupCards({ me }) {
  const all = await listGroups();
  const led = new Set((me.ledGroups || []).map((g) => g.id));
  const mine = sortGroups(all.filter((g) => !led.has(g.id) && (g.members.some((m) => m.id === me.id) || teamLeadIdsOf(g).includes(me.id))));
  if (!mine.length) return null;
  const ids = [...new Set(mine.flatMap((g) => [...headIdsOf(g), ...teamLeadIdsOf(g)]))];
  const { data } = ids.length ? await db().from("members").select("id, name").in("id", ids) : { data: [] };
  const name = Object.fromEntries([...(data || []), ...mine.flatMap((g) => g.members)].map((m) => [m.id, m.name]));
  const names = (list) => list.map((id) => name[id]).filter(Boolean).join(", ");
  return (
    <section className="rise">
      <h2 className="mb-2 text-[13px] font-medium text-muted">
        Your groups <span className="text-faint">· {mine.length}</span>
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {mine.map((g) => {
          const heads = headIdsOf(g);
          const tl = teamLeadIdsOf(g);
          const people = g.members.filter((m) => m.active);
          const role = tl.includes(me.id) ? "Team lead" : runsGroup(g, me.id) ? "Manager" : "Member";
          const body = (
            <>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-[15px] font-medium">{g.name}</div>
                  <div className="text-[11px] text-muted">{GROUP_KINDS.find((k) => k.id === g.kind)?.label || g.kind}</div>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-medium ${role === "Member" ? "bg-panel-2 text-muted" : "bg-brand/12 text-brand"}`}>{role}</span>
              </div>
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[12px]">
                {g.kind !== "execution" && (
                  <>
                    <dt className="text-muted">{ownHeadIds(g).length ? (heads.length > 1 ? "Managers" : "Manager") : "CBO"}</dt>
                    <dd className="truncate">{names(heads) || <span className="text-faint">Not set</span>}</dd>
                    <dt className="text-muted">{tl.length > 1 ? "Team leads" : "Team lead"}</dt>
                    <dd className="truncate">{names(tl) || <span className="text-faint">Not set</span>}</dd>
                  </>
                )}
              </dl>
              <div className="mt-3 flex items-center gap-2">
                <span className="flex -space-x-2">
                  {people.slice(0, 5).map((m) => (
                    <Avatar key={m.id} name={m.name} size={24} />
                  ))}
                </span>
                <span className="truncate text-[11px] text-muted">
                  {people.length} {people.length === 1 ? "person" : "people"}
                </span>
              </div>
            </>
          );
          return runsGroup(g, me.id) || me.role === "admin" ? (
            <Link key={g.id} href={`/groups/${g.id}`} className="card card-hover block p-4">
              {body}
            </Link>
          ) : (
            <Link key={g.id} href="/groups" className="card card-hover block p-4">
              {body}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/** The private to-do list (admin and the CBOs only). */
async function Notes({ me }) {
  if (!canKeepNotes(me)) return null;
  return <MyNotes initial={await myNotes(me.id)} />;
}

/** The admin overview's top row (as it was before the calmer redesign): team meetings, then group cards. */
function AdminTop({ me }) {
  return (
    <div className="flex flex-col gap-4">
      <Notes me={me} />
      <Meetings me={me} />
      <BrandMonth />
      <GroupCards me={me} />
    </div>
  );
}

/** The top of the right column on every dashboard: team meetings, then the groups you're in. */
function Side({ me }) {
  return (
    <>
      <Notes me={me} />
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
      {isOpsHead(me) && (
        <div className="mb-5">
          <BrandMonth />
        </div>
      )}
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
      <AdminOverview
        me={me}
        data={data}
        brands={brands}
        tasks={tasks}
        actions={<QuickAssign brands={active} people={people} label="New task" />}
        meetings={<AdminTop me={me} />}
      />
    );
  }

  // Everyone else: the admin look, about their own work (tasks, leads and/or briefs — whatever they do)
  const [data, tasks, followUps] = await Promise.all([dashboardData(me), listTasks(me, { view: "mine" }), myFollowUps(me)]);
  return <UserHome me={me} data={data} tasks={tasks} followUps={followUps} side={<Side me={me} />} sub={(me.groups || []).map((g) => g.name).join(", ")} />;
}
