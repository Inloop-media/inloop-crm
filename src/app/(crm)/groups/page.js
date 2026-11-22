// Every group (team) at a glance: who manages it, its team leads, the people in it and how much work it has on.
// Laid out the way the company runs: Admin → the CBO group (Udit sir, Krish sir, Arushi ma'am) → each CBO's groups.
// Admin sees every group; everyone else sees the groups they run, lead or are in.
import Link from "next/link";
import Icon from "@/components/Icon";
import NewGroupButton from "@/components/NewGroupButton";
import { PageTop } from "@/components/Desk";
import { Avatar, Empty, tint } from "@/components/ui";
import { requireMember } from "@/lib/auth";
import { listGroups } from "@/lib/leads";
import { db } from "@/lib/supabase/server";
import { isOpsHead } from "@/lib/permissions";
import { headIdsOf, isOperationsGroup, operationsHeadIds, ownHeadIds, runsGroup, sortGroups, teamLeadIdsOf } from "@/lib/groups";
import { CLOSED_STATUSES, GROUP_KINDS, OPEN_TASK } from "@/lib/constants";

export const metadata = { title: "Groups" };

const nowMs = () => Date.now();
const first = (n) => String(n || "").split(" ")[0];

export default async function GroupsPage() {
  const me = await requireMember();
  const admin = me.role === "admin";
  const all = sortGroups(await listGroups());
  const groups = all.filter((g) => admin || runsGroup(g, me.id) || teamLeadIdsOf(g).includes(me.id) || g.members.some((m) => m.id === me.id));
  const people = [...new Set(groups.flatMap((g) => g.members.map((m) => m.id)))];
  const [{ data: tasks }, { data: leads }, { data: names }] = await Promise.all([
    people.length ? db().from("tasks").select("assignee_id, due_at").in("status", OPEN_TASK).in("assignee_id", people) : { data: [] },
    people.length ? db().from("leads").select("assigned_to, status").in("assigned_to", people) : { data: [] },
    db().from("members").select("id, name"),
  ]);
  const name = Object.fromEntries((names || []).map((m) => [m.id, m.name]));
  const now = nowMs();
  const nameList = (ids) => ids.map((id) => name[id]).filter(Boolean).join(", ");

  // Sections: under Admin (the CBO group, anything not under a CBO), then one per CBO
  const opsHeads = operationsHeadIds(all);
  const underAdmin = (g) => isOperationsGroup(g) || !opsHeads.includes(g.owner_id);
  const sections = [
    { key: "admin", title: "Under Admin", items: groups.filter(underAdmin) },
    ...opsHeads.map((h) => ({ key: h, title: `Under ${name[h] || "a CBO"}`, items: groups.filter((g) => !underAdmin(g) && g.owner_id === h) })),
  ].filter((s) => s.items.length);

  const openOf = (g) => {
    const ids = g.members.filter((m) => m.active).map((m) => m.id);
    return g.kind === "sales" ? (leads || []).filter((l) => ids.includes(l.assigned_to) && !CLOSED_STATUSES.includes(l.status)).length : (tasks || []).filter((t) => ids.includes(t.assignee_id)).length;
  };
  const maxOpen = Math.max(1, ...groups.map(openOf));
  const lateAll = (tasks || []).filter((t) => t.due_at && new Date(t.due_at).getTime() < now).length;

  const card = (g) => {
    const kind = GROUP_KINDS.find((k) => k.id === g.kind);
    const activeMembers = g.members.filter((m) => m.active);
    const ids = activeMembers.map((m) => m.id);
    const sales = g.kind === "sales";
    const ops = isOperationsGroup(g);
    const open = sales ? (leads || []).filter((l) => ids.includes(l.assigned_to) && !CLOSED_STATUSES.includes(l.status)).length : (tasks || []).filter((t) => ids.includes(t.assignee_id)).length;
    const late = sales ? 0 : (tasks || []).filter((t) => ids.includes(t.assignee_id) && t.due_at && new Date(t.due_at).getTime() < now).length;
    const canOpen = admin || runsGroup(g, me.id);
    const own = ownHeadIds(g);
    const heads = headIdsOf(g);
    const tl = teamLeadIdsOf(g);
    const who = (ids, empty) =>
      ids.length ? (
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="flex shrink-0 -space-x-1.5">
            {ids.slice(0, 3).map((id) => (
              <Avatar key={id} name={name[id] || "?"} size={20} />
            ))}
          </span>
          <span className="truncate">{nameList(ids)}</span>
        </span>
      ) : (
        <span className="text-faint">{empty}</span>
      );
    const c = tint(g.name);
    const body = (
      <>
        <div className="flex items-start gap-3">
          <span
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
            style={{ background: `color-mix(in srgb, ${c} 14%, transparent)`, color: c }}
          >
            <Icon name={sales ? "leads" : ops ? "team" : "tasks"} size={17} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15.5px] font-medium group-hover:text-brand">{g.name}</div>
            <div className="text-[12px] text-muted">{kind?.label || g.kind}</div>
          </div>
          {canOpen && <Icon name="arrow" size={14} className="mt-1 text-faint transition group-hover:translate-x-0.5 group-hover:text-ink" />}
        </div>
        <dl className="mt-4 flex flex-col gap-2 text-[12.5px]">
          <div className="flex items-center gap-3">
            <dt className="w-[72px] shrink-0 text-muted">{ops ? "CBOs" : heads.length > 1 ? "Managers" : "Manager"}</dt>
            <dd className="flex min-w-0 items-center gap-1">
              {who(heads, "Not set")}
              {!own.length && heads.length > 0 && !ops && <span className="shrink-0 text-faint">· CBO</span>}
            </dd>
          </div>
          {!ops && (
            <div className="flex items-center gap-3">
              <dt className="w-[72px] shrink-0 text-muted">{tl.length > 1 ? "Team leads" : "Team lead"}</dt>
              <dd className="min-w-0">{who(tl, "Not set")}</dd>
            </div>
          )}
          <div className="flex items-center gap-3">
            <dt className="w-[72px] shrink-0 text-muted">People</dt>
            <dd className="min-w-0 truncate">
              {ids.length ? (
                <>
                  {ids.length} · <span className="text-muted">{activeMembers.slice(0, 4).map((m) => first(m.name)).join(", ")}{ids.length > 4 ? "…" : ""}</span>
                </>
              ) : (
                <span className="text-faint">No one yet</span>
              )}
            </dd>
          </div>
        </dl>
        {!ops && (
          <div className="mt-auto pt-4">
            <div className="flex items-baseline justify-between border-t border-line pt-3 text-[12px]">
              <span className="text-muted">
                <b className="text-[15px] font-medium tabular-nums text-ink">{open}</b> {sales ? "open leads" : "open tasks"}
              </span>
              {late > 0 ? <span className="font-medium text-rose-500">{late} late</span> : open > 0 ? <span className="text-emerald-600 dark:text-emerald-400">On time</span> : <span className="text-faint">Free</span>}
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-panel-2">
              <span className={`block h-full rounded-full ${late ? "bg-rose-500" : "bg-ink/60"}`} style={{ width: `${Math.min(100, (open / maxOpen) * 100)}%` }} />
            </div>
          </div>
        )}
      </>
    );
    return canOpen ? (
      <Link key={g.id} href={`/groups/${g.id}`} className="group card card-hover flex flex-col p-5">
        {body}
      </Link>
    ) : (
      <div key={g.id} className="card flex flex-col p-5">
        {body}
      </div>
    );
  };

  return (
    <div className="page">
      <PageTop
        title="Groups"
        sub={admin ? `All ${groups.length} groups, who runs them and how much work each has on.` : isOpsHead(me) ? "The CBO group and the groups that come under you." : "The groups you're part of."}
        right={
          admin ? (
            <Link href="/team#groups" className="btn-ghost btn-sm">
              <Icon name="team" size={13} /> Manage on Team page
            </Link>
          ) : (
            isOpsHead(me) && <NewGroupButton />
          )
        }
      />
      {!sections.length ? (
        <div className="card"><Empty icon="team">No groups yet.</Empty></div>
      ) : (
        <>
          <div className="rise mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Groups", groups.length],
              ["People", people.length],
              ["Open tasks", (tasks || []).length],
              ["Late", lateAll, lateAll ? "text-rose-500" : ""],
            ].map(([l, v, cls]) => (
              <div key={l} className="card px-4 py-3">
                <div className="text-[12px] text-muted">{l}</div>
                <div className={`mt-0.5 text-[24px] font-light tabular-nums tracking-[-0.02em] ${cls || ""}`}>{v}</div>
              </div>
            ))}
          </div>
          <div className="rise flex flex-col gap-8">
            {sections.map((s) => {
              const lead = s.key === "admin" ? "Admin" : name[s.key] || "CBO";
              return (
                <section key={s.key}>
                  <h2 className="mb-3 flex items-center gap-2.5">
                    <Avatar name={lead} size={26} />
                    <span className="text-[14px] font-medium">{s.title}</span>
                    <span className="rounded-full bg-panel-2 px-2 py-0.5 text-[11px] tabular-nums text-muted">{s.items.length}</span>
                    <span className="h-px flex-1 bg-line" />
                  </h2>
                  <div className="grid items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-3">{s.items.map(card)}</div>
                </section>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
