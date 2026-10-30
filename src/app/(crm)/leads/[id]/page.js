import Link from "next/link";
import { notFound } from "next/navigation";
import Icon from "@/components/Icon";
import { Notes, OwnerPicker, StatusPicker } from "@/components/LeadEditor";
import MeetingsPanel from "@/components/MeetingsPanel";
import ProposalWorkspace from "@/components/ProposalWorkspace";
import { Avatar, PageHeader, Panel, StagePill, StepTrack } from "@/components/ui";
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
    <div className="well flex min-w-0 items-start gap-3 p-4">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-panel text-muted shadow-[var(--card-shadow)]">
        <Icon name={icon} size={15} />
      </span>
      <div className="min-w-0">
        <dt className="text-xs text-muted">{label}</dt>
        <dd className="mt-0.5 break-words text-sm font-medium">{children || <span className="font-normal text-faint">—</span>}</dd>
      </div>
    </div>
  );
}

function QuickAction({ href, icon, label, external, primary }) {
  return (
    <a href={href} {...(external ? { target: "_blank", rel: "noreferrer" } : {})} className={`${primary ? "btn-primary" : "btn-ghost"} flex-1 sm:flex-none`}>
      <Icon name={icon} size={15} />
      {label}
    </a>
  );
}

function Section({ title, sub, children, action, id }) {
  return (
    <Panel title={title} sub={sub} action={action} className={id ? "scroll-mt-24 md:scroll-mt-6" : ""} id={id}>
      {children}
    </Panel>
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
    <div className="page max-w-6xl">
      <PageHeader back={{ href: "/leads", label: "Leads" }} />

      {/* Header + key facts, so nobody has to scroll for the phone number */}
      <section className="rise card relative -mt-2 overflow-hidden">
        <span className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full blur-3xl" style={{ background: `color-mix(in srgb, ${statusColor(lead.status)} 22%, transparent)` }} />
        <div className="relative flex flex-wrap items-start justify-between gap-6 p-6 sm:p-8">
          <div className="flex min-w-0 items-start gap-4">
            <Avatar name={lead.brand || fullName(lead)} size={64} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                <span className="code">{lead.code}</span>
                <span>Registered {fmtDateTime(lead.created_at)}</span>
              </div>
              <h1 className="mt-2 text-[30px] font-medium leading-tight tracking-[-0.02em] md:text-[40px]">{lead.brand || fullName(lead)}</h1>
              <div className="mt-3 flex flex-wrap items-center gap-2.5 text-sm text-muted">
                <StatusBadge status={lead.status} />
                <span>{lead.brand ? fullName(lead) : lead.email}</span>
                <span className="h-1 w-1 rounded-full bg-faint" />
                {owner ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Avatar name={owner.name} size={22} />
                    {owner.name}
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-400/15 px-2.5 py-1 text-xs font-medium text-amber-300">Unassigned</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex w-full gap-2 sm:w-auto">
            {phone && <QuickAction href={`tel:${phone}`} icon="phone" label="Call" primary />}
            {phone && <QuickAction href={`https://wa.me/${whatsapp}`} icon="chat" label="WhatsApp" external />}
            {lead.email && <QuickAction href={`mailto:${lead.email}`} icon="mail" label="Email" />}
          </div>
        </div>

        <dl className="relative grid grid-cols-1 gap-2.5 px-6 pb-6 sm:grid-cols-2 sm:px-8 sm:pb-8 md:grid-cols-3">
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
          <div className="relative px-6 pb-6 sm:px-8 sm:pb-8">
            <div className="tint-lavender rounded-2xl p-5">
              <div className="text-xs font-medium text-ink/60">Project details</div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{lead.details}</p>
            </div>
          </div>
        )}
      </section>

      <div className="rise rise-2 mt-5 grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="flex min-w-0 flex-col gap-5">
          <Section title="Status" sub="Click a stage to move the lead">
            <StatusPicker lead={lead} statuses={statusOptions(me)} />
          </Section>

          <Section title="Notes">
            <Notes lead={lead} />
          </Section>

          <Section title="Meetings" sub="Google Meet calls with the client">
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

        <div className="flex flex-col gap-5">
          <Section title="Owner" action={lead.assigned_at ? <span className="text-[11px] text-faint">since {fmtDateTime(lead.assigned_at)}</span> : null}>
            <OwnerPicker lead={lead} members={members} assignees={assignees} canAssign={canAssign(me)} openCounts={openCounts} />
          </Section>
          <Section title="History" sub="Everything that happened on this lead">
            <Timeline events={lead.events} />
          </Section>
        </div>
      </div>
    </div>
  );
}
