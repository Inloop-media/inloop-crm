import Link from "next/link";
import { Suspense } from "react";
import Board from "@/components/Board";
import LeadList from "@/components/LeadList";
import LeadsToolbar from "@/components/LeadsToolbar";
import { requireMember } from "@/lib/auth";
import { listLeads, listMembers } from "@/lib/leads";
import { canCreateLead, canSeeAllLeads } from "@/lib/permissions";

export const metadata = { title: "Leads" };

export default async function LeadsPage({ searchParams }) {
  const me = await requireMember();
  const { view, q, owner, status } = await searchParams;
  const isList = view === "list";
  const [leads, members] = await Promise.all([
    listLeads(me, { q, owner, status: isList ? status : undefined }),
    listMembers(),
  ]);
  const owners = Object.fromEntries(members.map((m) => [m.id, m.name]));
  const all = canSeeAllLeads(me);

  return (
    <div className="px-4 py-6 md:px-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{all ? "Leads" : "My leads"}</h1>
          <p className="text-sm text-muted">
            {leads.length} lead{leads.length === 1 ? "" : "s"}
            {!all && " assigned to you"}
          </p>
        </div>
        {canCreateLead(me) && (
          <Link href="/leads/new" className="btn-primary">
            + New lead
          </Link>
        )}
      </div>
      <div className="mb-5">
        <Suspense>
          <LeadsToolbar members={members.filter((m) => m.active)} showOwner={all} />
        </Suspense>
      </div>
      {isList ? <LeadList leads={leads} owners={owners} /> : <Board leads={leads} owners={owners} />}
    </div>
  );
}
