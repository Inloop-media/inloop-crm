import Link from "next/link";
import { notFound } from "next/navigation";
import Icon from "@/components/Icon";
import { Notes, OwnerPicker, StatusPicker } from "@/components/LeadEditor";
import MeetingsPanel from "@/components/MeetingsPanel";
import ProposalWorkspace from "@/components/ProposalWorkspace";
import { Avatar, StagePill, StepTrack } from "@/components/ui";
import StatusBadge from "@/components/StatusBadge";
import Timeline from "@/components/Timeline";
import { requireMember } from "@/lib/auth";
import { getLead, listAssignees, listGuests, listMembers, openLeadCounts } from "@/lib/leads";
import { canAssign, canBookDiscovery, canBookProposal, canEnterCommercials, canSeeLeads, isStrategist, statusOptions } from "@/lib/permissions";
import { fmtDateTime, fullName } from "@/lib/format";
import { statusColor } from "@/lib/constants";

export async function generateMetadata({ params }) {
  const { id } = await params;
  const me = await requireMember();
  const lead = await getLead(me, id);
  return { title: lead ? `${lead.code} · ${lead.brand || fullName(lead)}` : "Lead" };
}

function Detail({ label, icon, children }) {
  return (
    <div className="flex min-w-0 gap-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-line bg-panel-2 text-muted">
        <Icon name={icon} size={15} />
      </span>
      <div className="min-w-0">
        <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-faint">{label}</dt>
        <dd className="mt-0.5 break-words text-sm font-medium">{children || <span className="font-normal text-faint">—</span>}</dd>
      </div>
    </div>
  );
}

function QuickAction({ href, icon, label, external }) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
      className="flex flex-1 flex-col items-center gap-1.5 rounded-2xl border border-line bg-panel-2/60 px-3 py-2.5 text-xs font-medium text-ink/85 transition hover:border-brand/40 hover:bg-brand/[0.06] hover:text-ink sm:flex-none sm:flex-row sm:rounded-xl sm:px-3.5 sm:py-2"
    >
      <Icon name={icon} size={16} className="text-brand" />
      {label}
    </a>
  );
}

function Section({ title, children, action, id }) {
  return (
    <section id={id} className="card scroll-mt-24 p-4 sm:p-6 md:scroll-mt-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em]">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export default async function LeadPage({ params }) {
  const { id } = await params;
  const me = await requireMember(canSeeLeads);
  const [lead, members, assignees, openCounts, guestRows] = await Promise.all([
    getLead(me, id),
    listMembers({ activeOnly: true }),
    listAssignees(),
    canAssign(me) ? openLeadCounts() : {},
    listGuests(),
  ]);
  // Names only in the browser — the server looks the emails up when booking
  const guests = guestRows.map(({ id, name, is_default }) => ({ id, name, is_default }));
  if (!lead) notFound();
  const owner = members.find((m) => m.id === lead.assigned_to);
  const phone = lead.phone.replace(/[^\d+]/g, "");
  // wa.me needs the country code; 10-digit numbers are Indian
  const whatsapp = phone.replace(/^\+/, "").replace(/^0?(\d{10})$/, "91$1");

  return (
    <div className="relative z-[1] mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-9">
      <Link href="/leads" className="inline-flex items-center gap-1.5 text-sm text-muted transition hover:text-ink">
        <Icon name="back" size={14} /> Leads
      </Link>

      {/* Header + key facts, so nobody has to scroll for the phone number */}
      <section className="rise card relative mt-4 overflow-hidden">
        <span className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full blur-3xl" style={{ background: `color-mix(in srgb, ${statusColor(lead.status)} 18%, transparent)` }} />
        <div className="relative flex flex-wrap items-start justify-between gap-5 p-5 sm:p-7">
          <div className="flex min-w-0 items-start gap-4">
            <Avatar name={lead.brand || fullName(lead)} size={56} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                <span className="rounded-md bg-panel-2 px-1.5 py-0.5 font-medium tabular-nums">{lead.code}</span>
                <span>Registered {fmtDateTime(lead.created_at)}</span>
              </div>
              <h1 className="mt-2 font-serif text-[36px] font-normal leading-[1] md:text-[52px]">{lead.brand || fullName(lead)}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
                <StatusBadge status={lead.status} />
                <span>{lead.brand ? fullName(lead) : lead.email}</span>
                <span className="text-faint">·</span>
                {owner ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Avatar name={owner.name} size={18} />
                    {owner.name}
                  </span>
                ) : (
                  <span className="text-amber-400">Unassigned</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex w-full gap-2 sm:w-auto">
            {phone && <QuickAction href={`tel:${phone}`} icon="phone" label="Call" />}
            {phone && <QuickAction href={`https://wa.me/${whatsapp}`} icon="chat" label="WhatsApp" external />}
            {lead.email && <QuickAction href={`mailto:${lead.email}`} icon="mail" label="Email" />}
          </div>
        </div>

        <dl className="relative grid grid-cols-1 gap-x-6 gap-y-5 border-t border-line p-5 sm:grid-cols-2 sm:p-7 md:grid-cols-3">
          <Detail label="Service" icon="sparkle">{lead.service}</Detail>
          <Detail label="Budget" icon="rupee">{lead.budget}</Detail>
          <Detail label="Location" icon="pin">{lead.location}</Detail>
          <Detail label="Phone" icon="phone">{lead.phone && <a href={`tel:${phone}`} className="hover:text-brand">{lead.phone}</a>}</Detail>
          <Detail label="Email" icon="mail">{lead.email && <a href={`mailto:${lead.email}`} className="break-all hover:text-brand">{lead.email}</a>}</Detail>
          <Detail label="Source" icon="link">
            <span className="capitalize">{lead.source}</span>
            {lead.newsletter ? <span className="font-normal text-muted"> · newsletter</span> : null}
          </Detail>
        </dl>
        {lead.details && (
          <div className="relative border-t border-line p-5 sm:p-7">
            <div className="eyebrow">Project details</div>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink/85">{lead.details}</p>
          </div>
        )}
      </section>

      <div className="rise rise-2 mt-4 grid gap-4 lg:grid-cols-[1fr_340px]">
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
              guests={guests}
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
          <aside className="card p-4 sm:p-6">
            <h2 className="mb-5 text-[15px] font-semibold tracking-[-0.01em]">History</h2>
            <Timeline events={lead.events} />
          </aside>
        </div>
      </div>
    </div>
  );
}
