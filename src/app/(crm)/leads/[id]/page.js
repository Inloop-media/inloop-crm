import Link from "next/link";
import { notFound } from "next/navigation";
import LeadEditor from "@/components/LeadEditor";
import StatusBadge from "@/components/StatusBadge";
import Timeline from "@/components/Timeline";
import { requireMember } from "@/lib/auth";
import { getLead, listMembers } from "@/lib/leads";
import { canAssign } from "@/lib/permissions";
import { fmtDateTime, fullName } from "@/lib/format";

export async function generateMetadata({ params }) {
  const { id } = await params;
  const me = await requireMember();
  const lead = await getLead(me, id);
  return { title: lead ? `${lead.code} · ${lead.brand || fullName(lead)}` : "Lead" };
}

function Detail({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-1 break-words text-sm">{children || "—"}</dd>
    </div>
  );
}

export default async function LeadPage({ params }) {
  const { id } = await params;
  const me = await requireMember();
  const [lead, members] = await Promise.all([getLead(me, id), listMembers({ activeOnly: true })]);
  if (!lead) notFound();

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
      <Link href="/leads" className="text-sm text-muted hover:text-white">
        ← Leads
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm text-muted">{lead.code}</div>
          <h1 className="mt-1 text-2xl font-semibold">{lead.brand || fullName(lead)}</h1>
          {lead.brand && <p className="text-sm text-muted">{fullName(lead)}</p>}
        </div>
        <StatusBadge status={lead.status} className="text-sm" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-6">
          <section className="rounded-xl border border-line bg-panel p-5">
            <dl className="grid gap-5 sm:grid-cols-2">
              <Detail label="Phone">{lead.phone && <a href={`tel:${lead.phone.replace(/\s/g, "")}`} className="hover:text-brand">{lead.phone}</a>}</Detail>
              <Detail label="Email">{lead.email && <a href={`mailto:${lead.email}`} className="hover:text-brand">{lead.email}</a>}</Detail>
              <Detail label="Location">{lead.location}</Detail>
              <Detail label="Service interest">{lead.service}</Detail>
              <Detail label="Estimated budget">{lead.budget}</Detail>
              <Detail label="Registered">{fmtDateTime(lead.created_at)}</Detail>
              <Detail label="Source">{lead.source}</Detail>
              <Detail label="Newsletter">{lead.newsletter ? "Yes" : "No"}</Detail>
            </dl>
            {lead.details && (
              <div className="mt-5 border-t border-line pt-5">
                <div className="text-xs uppercase tracking-wide text-muted">Project details</div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-white/85">{lead.details}</p>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-line bg-panel p-5">
            <LeadEditor lead={lead} members={members} canAssign={canAssign(me)} />
          </section>
        </div>

        <aside className="rounded-xl border border-line bg-panel p-5">
          <h2 className="mb-4 text-sm font-medium">History</h2>
          <Timeline events={lead.events} />
        </aside>
      </div>
    </div>
  );
}
