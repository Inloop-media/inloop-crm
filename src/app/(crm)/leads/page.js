import Link from "next/link";
import { Suspense } from "react";
import Board from "@/components/Board";
import Icon from "@/components/Icon";
import LeadList from "@/components/LeadList";
import LeadsToolbar from "@/components/LeadsToolbar";
import { requireMember } from "@/lib/auth";
import { listLeads, listMembers } from "@/lib/leads";
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
    <div className="relative z-[1] px-4 py-6 md:px-8 md:py-9">
      <div className="rise mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Pipeline</p>
          <h1 className="page-title mt-1.5">{all ? <>All <em>leads</em></> : <>My <em>leads</em></>}</h1>
          <p className="mt-1 text-sm text-muted">
            {leads.length} lead{leads.length === 1 ? "" : "s"}
            {!all && " assigned to you"}
          </p>
        </div>
        {canCreateLead(me) && (
          <Link href="/leads/new" className="btn-primary">
            <Icon name="plus" size={14} /> New lead
          </Link>
        )}
      </div>
      <div className="rise rise-1 mb-5">
        <Suspense>
          <LeadsToolbar members={members.filter((m) => m.active && m.groups.some((g) => g.kind === "sales"))} showOwner={all} />
        </Suspense>
      </div>
      {isList ? <LeadList leads={leads} owners={owners} /> : <Board leads={leads} owners={owners} allowed={statusOptions(me)} />}
    </div>
  );
}
