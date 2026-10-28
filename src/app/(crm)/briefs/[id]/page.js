import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import Icon from "@/components/Icon";
import ProposalWorkspace from "@/components/ProposalWorkspace";
import { Panel, StagePill, StepTrack } from "@/components/ui";
import { requireMember } from "@/lib/auth";
import { getProposal } from "@/lib/leads";
import { canEnterCommercials, canSeeAllLeads, canSeeBriefs, canWorkOnProposal, isStrategist } from "@/lib/permissions";
import { fmtDateTime, fullName } from "@/lib/format";

export async function generateMetadata({ params }) {
  const { id } = await params;
  const me = await requireMember();
  const p = await getProposal(me, id);
  return { title: p ? `${p.lead.code} · Brief` : "Brief" };
}

function Fact({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-1 break-words text-sm">{children || <span className="text-faint">—</span>}</dd>
    </div>
  );
}

export default async function BriefPage({ params }) {
  const { id } = await params;
  const me = await requireMember(canSeeBriefs);
  // Admin / ops work on proposals from the lead page
  if (canSeeAllLeads(me)) redirect(`/leads/${id}#proposal`);
  const p = await getProposal(me, id);
  if (!p) notFound();
  const lead = p.lead;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-9">
      <Link href="/briefs" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-white">
        <Icon name="back" size={14} /> Briefs
      </Link>

      <header className="rise mt-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm text-muted">
            <span className="rounded-md border border-line px-1.5 py-0.5 text-xs">{lead.code}</span>
            <span>Shared {fmtDateTime(p.shared_at)}</span>
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{lead.brand || fullName(lead)}</h1>
          <p className="mt-1 text-sm text-muted">{[lead.service, lead.location].filter(Boolean).join(" · ")}</p>
        </div>
        <StagePill stage={p.stage} />
      </header>

      <div className="rise mt-6 [animation-delay:60ms]">
        <StepTrack stage={p.stage} />
      </div>

      <div className="rise mt-6 grid gap-4 [animation-delay:120ms] lg:grid-cols-[380px_1fr]">
        <div className="flex flex-col gap-4">
          <Panel title="Client brief">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/85">{lead.brief || "No brief text."}</p>
          </Panel>
          <Panel title="About the lead">
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <Fact label="Client">{fullName(lead)}</Fact>
              <Fact label="Service interest">{lead.service}</Fact>
              <Fact label="Estimated budget">{lead.budget}</Fact>
              <Fact label="Location">{lead.location}</Fact>
            </dl>
            {lead.details && (
              <div className="mt-4 border-t border-line pt-4">
                <div className="eyebrow">Project details</div>
                <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-white/75">{lead.details}</p>
              </div>
            )}
          </Panel>
        </div>
        <Panel title="Proposal">
          <ProposalWorkspace
            proposal={p}
            canPick={isStrategist(me) && !p.strategist_id}
            canWork={canWorkOnProposal(me, p)}
            canCommercials={canEnterCommercials(me)}
          />
        </Panel>
      </div>
    </div>
  );
}
