import Link from "next/link";
import { notFound } from "next/navigation";
import Icon from "@/components/Icon";
import { Notes, OwnerPicker, StatusPicker } from "@/components/LeadEditor";
import MeetingsPanel from "@/components/MeetingsPanel";
import ProposalWorkspace from "@/components/ProposalWorkspace";
import { StagePill, StepTrack } from "@/components/ui";
import StatusBadge from "@/components/StatusBadge";
import Timeline from "@/components/Timeline";
import { requireMember } from "@/lib/auth";
import { getLead, listAssignees, listMembers, openLeadCounts } from "@/lib/leads";
import { canAssign, canBookDiscovery, canBookProposal, canEnterCommercials, canSeeLeads, isStrategist, statusOptions } from "@/lib/permissions";
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
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-1 break-words text-sm">{children || <span className="text-faint">—</span>}</dd>
    </div>
  );
}

function Section({ title, children, action, id }) {
  return (
    <section id={id} className="card scroll-mt-6 p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export default async function LeadPage({ params }) {
  const { id } = await params;
  const me = await requireMember(canSeeLeads);
  const [lead, members, assignees, openCounts] = await Promise.all([
    getLead(me, id),
    listMembers({ activeOnly: true }),
    listAssignees(),
    canAssign(me) ? openLeadCounts() : {},
  ]);
  if (!lead) notFound();
  const owner = members.find((m) => m.id === lead.assigned_to);
  const phone = lead.phone.replace(/[^\d+]/g, "");
  // wa.me needs the country code; 10-digit numbers are Indian
  const whatsapp = phone.replace(/^\+/, "").replace(/^0?(\d{10})$/, "91$1");

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">
      <Link href="/leads" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-white">
        <Icon name="back" size={14} /> Leads
      </Link>

      <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm text-muted">
            <span className="rounded-md border border-line px-1.5 py-0.5 text-xs">{lead.code}</span>
            <span>Registered {fmtDateTime(lead.created_at)}</span>
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">{lead.brand || fullName(lead)}</h1>
          <p className="mt-1 text-sm text-muted">
            {lead.brand ? fullName(lead) : lead.email}
            {owner ? ` · Owner: ${owner.name}` : " · Unassigned"}
          </p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <StatusBadge status={lead.status} className="text-sm" />
          <div className="flex gap-2">
            {phone && (
              <a href={`tel:${phone}`} className="btn-ghost px-3 py-1.5 text-xs">
                <Icon name="phone" size={13} /> Call
              </a>
            )}
            {phone && (
              <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer" className="btn-ghost px-3 py-1.5 text-xs">
                WhatsApp
              </a>
            )}
            {lead.email && (
              <a href={`mailto:${lead.email}`} className="btn-ghost px-3 py-1.5 text-xs">
                <Icon name="mail" size={13} /> Email
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Key facts first, so nobody has to scroll for the phone number */}
      <section className="card mt-6 p-5">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-3 xl:grid-cols-6">
          <Detail label="Service">{lead.service}</Detail>
          <Detail label="Budget">{lead.budget}</Detail>
          <Detail label="Location">{lead.location}</Detail>
          <Detail label="Phone">{lead.phone && <a href={`tel:${phone}`} className="hover:text-brand">{lead.phone}</a>}</Detail>
          <Detail label="Email">{lead.email && <a href={`mailto:${lead.email}`} className="break-all hover:text-brand">{lead.email}</a>}</Detail>
          <Detail label="Source">
            <span className="capitalize">{lead.source}</span>
            {lead.newsletter ? <span className="text-muted"> · newsletter</span> : null}
          </Detail>
        </dl>
        {lead.details && (
          <div className="mt-4 border-t border-line pt-4">
            <div className="eyebrow">Project details</div>
            <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-white/85">{lead.details}</p>
          </div>
        )}
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Section title="Status">
            <StatusPicker lead={lead} statuses={statusOptions(me)} />
          </Section>

          <Section title="Notes">
            <Notes lead={lead} />
          </Section>

          <Section title="Meetings" action={<Icon name="calendar" className="text-muted" />}>
            <MeetingsPanel
              lead={{ id: lead.id, status: lead.status, has_brief: Boolean(lead.brief.trim()), has_proposal: Boolean(lead.proposal) }}
              meetings={lead.meetings}
              me={{ id: me.id, role: me.role }}
              canDiscovery={canBookDiscovery(me, lead)}
              canProposal={canBookProposal(me)}
              connected={Boolean(me.calendar_connected_at)}
              domain={process.env.ALLOWED_DOMAIN}
            />
          </Section>

          {lead.proposal && (
            <Section id="proposal" title="Proposal" action={<StagePill stage={lead.proposal.stage} />}>
              <div className="mb-5">
                <StepTrack stage={lead.proposal.stage} />
              </div>
              <ProposalWorkspace proposal={lead.proposal} canPick={isStrategist(me) && !lead.proposal.strategist_id} canWork canCommercials={canEnterCommercials(me)} />
            </Section>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <Section title="Owner" action={lead.assigned_at ? <span className="text-[11px] text-faint">since {fmtDateTime(lead.assigned_at)}</span> : null}>
            <OwnerPicker lead={lead} members={members} assignees={assignees} canAssign={canAssign(me)} openCounts={openCounts} />
          </Section>
          <aside className="card p-5">
            <h2 className="mb-5 text-sm font-medium">History</h2>
            <Timeline events={lead.events} />
          </aside>
        </div>
      </div>
    </div>
  );
}
