// Every group (team) at a glance: who heads it, its team lead, the people in it and how much work it has on.
// Admin sees every group; everyone else (ops included) sees the groups they head, lead or are in.
import Link from "next/link";
import Icon from "@/components/Icon";
import { PageTop } from "@/components/Desk";
import { Avatar, Empty } from "@/components/ui";
import { requireMember } from "@/lib/auth";
import { listGroups } from "@/lib/leads";
import { db } from "@/lib/supabase/server";
import { CLOSED_STATUSES, GROUP_KINDS, OPEN_TASK } from "@/lib/constants";

export const metadata = { title: "Groups" };

const nowMs = () => Date.now();
const first = (n) => String(n || "").split(" ")[0];

export default async function GroupsPage() {
  const me = await requireMember();
  const staff = me.role === "admin";
  const all = await listGroups();
  const groups = all.filter((g) => staff || g.lead_id === me.id || g.team_lead_id === me.id || g.members.some((m) => m.id === me.id));
  const people = [...new Set(groups.flatMap((g) => g.members.map((m) => m.id)))];
  const [{ data: tasks }, { data: leads }, { data: names }] = await Promise.all([
    people.length ? db().from("tasks").select("assignee_id, due_at").in("status", OPEN_TASK).in("assignee_id", people) : { data: [] },
    people.length ? db().from("leads").select("assigned_to, status").in("assigned_to", people) : { data: [] },
    db().from("members").select("id, name"),
  ]);
  const name = Object.fromEntries((names || []).map((m) => [m.id, m.name]));
  const now = nowMs();

  return (
    <div className="page">
      <PageTop title="Groups" sub={staff ? `All ${groups.length} teams, their heads and how much work each has on.` : "The teams you're part of."} right={staff && <Link href="/team" className="btn-ghost btn-sm"><Icon name="team" size={13} /> Manage on Team page</Link>} />
      {!groups.length ? (
        <div className="card"><Empty icon="team">No groups yet.</Empty></div>
      ) : (
        <div className="rise grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {groups.map((g) => {
            const kind = GROUP_KINDS.find((k) => k.id === g.kind);
            const ids = g.members.filter((m) => m.active).map((m) => m.id);
            const sales = g.kind === "sales";
            const open = sales ? (leads || []).filter((l) => ids.includes(l.assigned_to) && !CLOSED_STATUSES.includes(l.status)).length : (tasks || []).filter((t) => ids.includes(t.assignee_id)).length;
            const late = sales ? 0 : (tasks || []).filter((t) => ids.includes(t.assignee_id) && t.due_at && new Date(t.due_at).getTime() < now).length;
            const canOpen = staff || g.lead_id === me.id;
            const body = (
              <>
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[16px] font-medium">{g.name}</div>
                    <div className="text-xs text-muted">{kind?.label || g.kind}</div>
                  </div>
                  {canOpen && <Icon name="arrow" size={14} className="mt-1 text-faint" />}
                </div>
                <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12.5px]">
                  <dt className="text-muted">Head</dt>
                  <dd className="truncate">{name[g.lead_id] || <span className="text-faint">Not set</span>}</dd>
                  <dt className="text-muted">Team lead</dt>
                  <dd className="truncate">{name[g.team_lead_id] || <span className="text-faint">Not set</span>}</dd>
                </dl>
                <div className="mt-3 flex items-center gap-2">
                  <span className="flex -space-x-2">
                    {g.members.filter((m) => m.active).slice(0, 5).map((m) => (
                      <Avatar key={m.id} name={m.name} size={26} />
                    ))}
                  </span>
                  <span className="truncate text-xs text-muted">
                    {ids.length ? `${ids.length} ${ids.length === 1 ? "person" : "people"}${ids.length <= 3 ? ` · ${g.members.filter((m) => m.active).map((m) => first(m.name)).join(", ")}` : ""}` : "No one yet"}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line pt-3 text-[11.5px]">
                  <span className="rounded-full bg-panel-2 px-2 py-0.5 text-muted">
                    <b className="font-semibold text-ink">{open}</b> {sales ? "open leads" : "open tasks"}
                  </span>
                  {late > 0 && <span className="rounded-full bg-rose-400/15 px-2 py-0.5 font-medium text-rose-400">{late} late</span>}
                </div>
              </>
            );
            return canOpen ? (
              <Link key={g.id} href={`/groups/${g.id}`} className="card card-hover block p-4">
                {body}
              </Link>
            ) : (
              <div key={g.id} className="card p-4">
                {body}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
