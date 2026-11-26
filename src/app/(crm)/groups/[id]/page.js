// One team (group) as its heads and its CBO see it: the people in it, how much each has on, and the team's work.
// Making groups (designers, editors, production…) → their tasks. Sales → their leads.
import Link from "next/link";
import { notFound } from "next/navigation";
import Icon from "@/components/Icon";
import QuickAssign from "@/components/QuickAssign";
import GroupPeople from "@/components/GroupPeople";
import StatusBadge from "@/components/StatusBadge";
import { PageTop, Section, TaskLine } from "@/components/Desk";
import { Avatar, BrandMark, Empty, StatCard } from "@/components/ui";
import { requireMember } from "@/lib/auth";
import { listBrands } from "@/lib/brands";
import { listLeads } from "@/lib/leads";
import { listMakers, listTasks } from "@/lib/tasks";
import { db } from "@/lib/supabase/server";
import { canEditGroup, canSeeAllLeads } from "@/lib/permissions";
import { headIdsOf, operationsHeadIds, ownHeadIds, runsGroup, teamLeadIdsOf } from "@/lib/groups";
import { CLOSED_STATUSES, GROUP_KINDS, OPEN_TASK, byPriority } from "@/lib/constants";
import { fullName } from "@/lib/format";

const DAY = 864e5;
const nowMs = () => Date.now();
const dayKey = (d) => new Date(d).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

export async function generateMetadata({ params }) {
  const { id } = await params;
  const { data } = /^[0-9a-f-]{36}$/i.test(id) ? await db().from("groups").select("name").eq("id", id).maybeSingle() : { data: null };
  return { title: data?.name || "Group" };
}

export default async function GroupPage({ params }) {
  const { id } = await params;
  const me = await requireMember();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: group } = await db().from("groups").select("*, group_members(member:members(id, name, active))").eq("id", id).maybeSingle();
  if (!group) notFound();
  // Admin opens any group; everyone else only the groups they run (as a head or the CBO above it)
  if (me.role !== "admin" && !runsGroup(group, me.id)) notFound();

  const members = (group.group_members || []).map((g) => g.member).filter((m) => m?.active).sort((a, b) => a.name.localeCompare(b.name));
  const ids = members.map((m) => m.id);
  const [{ data: people_ }, { data: allGroups }] = await Promise.all([
    db().from("members").select("id, name, active").order("name"),
    db().from("groups").select("*"),
  ]);
  const nameOf = Object.fromEntries((people_ || []).map((m) => [m.id, m.name]));
  const heads = headIdsOf(group).map((h) => nameOf[h]).filter(Boolean);
  const head = heads.length ? { name: `${heads.join(", ")}${ownHeadIds(group).length ? "" : " (CBO)"}` } : null;
  const leadIds = teamLeadIdsOf(group);
  const editable = canEditGroup(me, group);
  const everyone = (people_ || []).filter((m) => m.active).map((m) => ({ id: m.id, name: m.name }));
  const opsHeads = operationsHeadIds(allGroups || []).filter((h) => nameOf[h]).map((h) => ({ id: h, name: nameOf[h] }));
  const groupMembers = (group.group_members || []).map((g) => g.member).filter(Boolean);
  const peopleBox = editable ? (
    <div className="card p-4">
      <div className="mb-3 text-[13px] font-medium">Who runs this group</div>
      <GroupPeople group={group} members={groupMembers} everyone={everyone} opsHeads={opsHeads} admin={me.role === "admin"} />
    </div>
  ) : leadIds.length ? (
    <div className="card px-4 py-3 text-[13px]">
      <span className="text-muted">{leadIds.length > 1 ? "Team leads" : "Team lead"}: </span>
      {leadIds.map((x) => nameOf[x]).filter(Boolean).join(", ")}
    </div>
  ) : null;
  const kind = GROUP_KINDS.find((k) => k.id === group.kind);
  const sales = group.kind === "sales";
  const now = nowMs();
  const today = dayKey(now);

  /* ---------------- Sales: the team's leads ---------------- */
  if (sales) {
    const all = canSeeAllLeads(me) || runsGroup(group, me.id) ? await listLeads(me) : [];
    const leads = all.filter((l) => ids.includes(l.assigned_to));
    const open = leads.filter((l) => !CLOSED_STATUSES.includes(l.status));
    const won = leads.filter((l) => l.status === "Won");
    const stale = open.filter((l) => now - new Date(l.updated_at || l.created_at).getTime() > 5 * DAY);
    const newWeek = leads.filter((l) => now - new Date(l.created_at).getTime() < 7 * DAY);
    return (
      <div className="page">
        <PageTop title={group.name} sub={`${kind?.label || group.kind} · ${members.length} people${head ? ` · Manager: ${head.name}` : ""}`} right={<Link href="/leads" className="btn-ghost btn-sm"><Icon name="leads" size={13} /> All leads</Link>} />
        <div className="rise grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatCard coral label="Open leads" value={open.length} note="Being worked on" />
          <StatCard label="New this week" value={newWeek.length} note="Assigned to the team" />
          <StatCard label="Need a follow-up" value={stale.length} tone="#fb7185" note="No update for 5+ days" />
          <StatCard label="Won" value={won.length} bar={leads.length ? Math.round((won.length / leads.length) * 100) : 0} />
        </div>
        <div className="rise mt-4">
          {peopleBox}
        </div>
        <section className="rise mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {members.map((m) => {
            const mine = leads.filter((l) => l.assigned_to === m.id);
            const mOpen = mine.filter((l) => !CLOSED_STATUSES.includes(l.status));
            return (
              <Link key={m.id} href={`/leads?view=list&owner=${m.id}`} className="card card-hover flex items-center gap-3 p-4">
                <Avatar name={m.name} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{m.name}{leadIds.includes(m.id) && <span className="ml-1.5 rounded-full bg-brand/12 px-1.5 py-0.5 text-[10px] font-medium text-brand">Team lead</span>}</div>
                  <div className="text-xs text-muted">
                    {mOpen.length} open · {mine.filter((l) => l.status === "Won").length} won · {stale.filter((l) => l.assigned_to === m.id).length} to follow up
                  </div>
                </div>
              </Link>
            );
          })}
          {!members.length && <div className="card col-span-full"><Empty icon="team">No one in this group yet — add people above.</Empty></div>}
        </section>
        <div className="rise mt-4">
          <Section title="Open leads" count={open.length} tone="#3b82f6" empty="No open leads.">
            {open.slice(0, 40).map((l) => (
              <li key={l.id} className="border-b border-line last:border-0">
                <Link href={`/leads/${l.id}`} className="group flex items-center gap-3 py-2.5">
                  <BrandMark name={l.brand || fullName(l)} size={30} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium group-hover:text-brand">{l.brand || fullName(l)}</span>
                    <span className="block text-[11px] text-muted">{l.code} · {members.find((m) => m.id === l.assigned_to)?.name.split(" ")[0]}</span>
                  </span>
                  <StatusBadge status={l.status} />
                </Link>
              </li>
            ))}
          </Section>
        </div>
      </div>
    );
  }

  /* ---------------- Making teams: the team's tasks ---------------- */
  const [allTasks, people, brands] = await Promise.all([listTasks(me, { view: "all" }), listMakers(me), listBrands()]);
  const tasks = allTasks.filter((t) => ids.includes(t.assignee_id));
  const isLate = (t) => OPEN_TASK.includes(t.status) && t.due_at && new Date(t.due_at).getTime() < now;
  const open = tasks.filter((t) => OPEN_TASK.includes(t.status));
  const late = open.filter(isLate).sort(byPriority);
  const working = open.filter((t) => !isLate(t)).sort(byPriority);
  const toCheck = tasks.filter((t) => ["completed", "client_rejected"].includes(t.status) && !t.with_lead).sort(byPriority);
  const approvedWeek = tasks.filter((t) => t.status === "done" && t.done_at && now - new Date(t.done_at).getTime() < 7 * DAY);
  const active = brands.filter((b) => b.stage === "active").map((b) => ({ id: b.id, name: b.name }));

  return (
    <div className="page">
      <PageTop
        title={group.name}
        sub={`${kind?.label || group.kind} · ${members.length} people${head ? ` · Manager: ${head.name}` : ""}`}
        right={<QuickAssign brands={active} people={people.filter((p) => ids.includes(p.id))} label="New task for this team" />}
      />
      <div className="rise grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard coral label="Open tasks" value={open.length} note={`${open.filter((t) => t.due_at && dayKey(t.due_at) === today).length} due today`} />
        <StatCard label="Late" value={late.length} tone="#fb7185" note={late.length ? "Past the due date" : "Nothing late"} />
        <StatCard label="To check" value={toCheck.length} note="Finished, waiting for review" />
        <StatCard label="Approved this week" value={approvedWeek.length} bar={tasks.length ? Math.round((tasks.filter((t) => t.status === "done").length / tasks.length) * 100) : 0} />
      </div>

      <div className="rise mt-4">
        {peopleBox}
      </div>
      <section className="rise mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {members.map((m) => {
          const mine = open.filter((t) => t.assignee_id === m.id);
          const mLate = mine.filter(isLate).length;
          return (
            <div key={m.id} className="card flex items-center gap-3 p-4">
              <Avatar name={m.name} size={40} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{m.name}{leadIds.includes(m.id) && <span className="ml-1.5 rounded-full bg-brand/12 px-1.5 py-0.5 text-[10px] font-medium text-brand">Team lead</span>}</div>
                <div className="text-xs text-muted">
                  {mine.length} open{mLate ? <span className="text-rose-400"> · {mLate} late</span> : ""} · {approvedWeek.filter((t) => t.assignee_id === m.id).length} approved this week
                </div>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${mine.length >= 6 ? "bg-rose-400/15 text-rose-400" : mine.length >= 3 ? "bg-amber-400/15 text-amber-400" : "bg-emerald-400/15 text-emerald-400"}`}>
                {mine.length >= 6 ? "Busy" : mine.length >= 3 ? "Steady" : "Free"}
              </span>
            </div>
          );
        })}
        {!members.length && <div className="card col-span-full"><Empty icon="team">No one in this group yet — add people above.</Empty></div>}
      </section>

      <div className="rise mt-4 grid items-start gap-4 lg:grid-cols-2">
        <Section title="Late" count={late.length} tone="#e11d48" empty="Nothing late ✓">
          {late.map((t) => <TaskLine key={t.id} t={t} />)}
        </Section>
        <Section title="To check" count={toCheck.length} tone="#8b5cf6" empty="Nothing to check ✓">
          {toCheck.map((t) => <TaskLine key={t.id} t={t} />)}
        </Section>
        <Section title="In progress" count={working.length} tone="#f59e0b" empty="No open work">
          {working.slice(0, 40).map((t) => <TaskLine key={t.id} t={t} />)}
        </Section>
        <Section title="Approved this week" count={approvedWeek.length} tone="#10b981" empty="Nothing approved yet this week">
          {approvedWeek.map((t) => <TaskLine key={t.id} t={t} />)}
        </Section>
      </div>
    </div>
  );
}
