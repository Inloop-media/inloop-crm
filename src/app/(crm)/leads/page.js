import Link from "next/link";
import { Suspense } from "react";
import Board from "@/components/Board";
import Icon from "@/components/Icon";
import LeadList from "@/components/LeadList";
import LeadsToolbar from "@/components/LeadsToolbar";
import { StatCard } from "@/components/ui";
import { FilterPills, PageTop } from "@/components/Desk";
import { requireMember } from "@/lib/auth";
import { listLeads, listMembers } from "@/lib/leads";
import { CLOSED_STATUSES, EXEC_VISIBLE_STATUSES, STATUS_NAMES } from "@/lib/constants";
import { canCreateLead, canSeeAllLeads, canSeeLeads, isSalesHead, salesTeam, statusOptions } from "@/lib/permissions";

export const metadata = { title: "Leads" };
const nowMs = () => Date.now();

export default async function LeadsPage({ searchParams }) {
  const me = await requireMember(canSeeLeads);
  const { view, q, owner, status } = await searchParams;
  const isList = view === "list";
  const [leads, members] = await Promise.all([
    listLeads(me, { q, owner, status: isList ? status : undefined }),
    listMembers(),
  ]);
  const owners = Object.fromEntries(members.map((m) => [m.id, m.name]));
  const all = canSeeAllLeads(me);

  const now = nowMs();
  const open = leads.filter((l) => !CLOSED_STATUSES.includes(l.status));
  const newWeek = leads.filter((l) => now - new Date(l.created_at).getTime() < 7 * 864e5);
  const unassigned = open.filter((l) => !l.assigned_to);
  const proposal = open.filter((l) => ["Proposal Meeting Scheduled", "Negotiation", "Waiting Client Decision"].includes(l.status));
  const won = leads.filter((l) => l.status === "Won");
  const viewHref = (v) => {
    const params = new URLSearchParams(Object.entries({ q, owner, status: v === "list" ? status : undefined, view: v === "list" ? "list" : undefined }).filter(([, x]) => x));
    return `/leads${params.size ? `?${params}` : ""}`;
  };

  return (
    <div className="page">
      <PageTop
        title={all ? "Leads" : isSalesHead(me) ? "Team leads" : "My leads"}
        sub={`${open.length} open · ${newWeek.length} new this week${all ? ` · ${unassigned.length} unassigned` : ""}`}
        right={
          <>
            <FilterPills
              items={[
                { label: "Board", href: viewHref("board"), on: !isList },
                { label: "List", href: viewHref("list"), on: isList },
              ]}
            />
            {canCreateLead(me) && (
              <Link href="/leads/new" className="btn-primary btn-sm">
                <Icon name="plus" size={13} /> New lead
              </Link>
            )}
          </>
        }
      />
      <div className="rise grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard coral label="New this week" value={newWeek.length} note="Fresh leads" />
        <StatCard label={all ? "Unassigned" : "Open"} value={all ? unassigned.length : open.length} tone={all ? "#e11d48" : undefined} note={all ? "Need an owner" : "Being worked on"} href={all ? "/leads?view=list&owner=unassigned" : undefined} />
        <StatCard label="In proposal" value={proposal.length} note="Meeting booked or negotiating" />
        <StatCard label="Won" value={won.length} bar={leads.length ? Math.round((won.length / leads.length) * 100) : 0} />
      </div>
      <div className="rise mb-4 mt-4">
        <Suspense>
          <LeadsToolbar members={members.filter((m) => m.active && m.groups.some((g) => g.kind === "sales") && (all || salesTeam(me).includes(m.id)))} showOwner={all || isSalesHead(me)} statuses={all || isSalesHead(me) ? STATUS_NAMES : EXEC_VISIBLE_STATUSES} />
        </Suspense>
      </div>
      {isList ? <LeadList leads={leads} owners={owners} /> : <Board leads={leads} owners={owners} allowed={statusOptions(me)} columns={all || isSalesHead(me) ? undefined : EXEC_VISIBLE_STATUSES} />}
    </div>
  );
}
