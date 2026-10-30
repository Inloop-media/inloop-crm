import Link from "next/link";
import { Suspense } from "react";
import Board from "@/components/Board";
import Icon from "@/components/Icon";
import LeadList from "@/components/LeadList";
import LeadsToolbar from "@/components/LeadsToolbar";
import { PageHeader } from "@/components/ui";
import { requireMember } from "@/lib/auth";
import { listLeads, listMembers } from "@/lib/leads";
import { EXEC_VISIBLE_STATUSES, STATUS_NAMES } from "@/lib/constants";
import { canCreateLead, canSeeAllLeads, canSeeLeads, statusOptions } from "@/lib/permissions";

export const metadata = { title: "Leads" };

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

  return (
    <div className="page">
      <PageHeader
        kicker="Pipeline"
        title={all ? "Leads" : "My leads"}
        sub={`${leads.length} lead${leads.length === 1 ? "" : "s"}${all ? "" : " assigned to you"}`}
        actions={
          canCreateLead(me) && (
            <Link href="/leads/new" className="btn-primary">
              <Icon name="plus" size={14} /> New lead
            </Link>
          )
        }
      />
      <div className="rise rise-1 mb-5">
        <Suspense>
          <LeadsToolbar members={members.filter((m) => m.active && m.groups.some((g) => g.kind === "sales"))} showOwner={all} statuses={all ? STATUS_NAMES : EXEC_VISIBLE_STATUSES} />
        </Suspense>
      </div>
      {isList ? <LeadList leads={leads} owners={owners} /> : <Board leads={leads} owners={owners} allowed={statusOptions(me)} />}
    </div>
  );
}
