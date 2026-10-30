import { notFound, redirect } from "next/navigation";
import ProposalWorkspace from "@/components/ProposalWorkspace";
import { PageHeader, Panel, StagePill, StepTrack } from "@/components/ui";
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
    <div className="well min-w-0 p-3.5">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 break-words text-sm font-medium">{children || <span className="text-faint">—</span>}</dd>
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
    <div className="page max-w-6xl">
      <PageHeader
        back={{ href: "/briefs", label: "Briefs" }}
        kicker={
          <span className="flex items-center gap-2">
            <span className="code">{lead.code}</span> Shared {fmtDateTime(p.shared_at)}
          </span>
        }
        title={lead.brand || fullName(lead)}
        sub={[lead.service, lead.location].filter(Boolean).join(" · ")}
        actions={<StagePill stage={p.stage} />}
      />

      <div className="rise card p-5 [animation-delay:60ms]">
        <StepTrack stage={p.stage} />
      </div>

      <div className="rise mt-5 grid gap-5 [animation-delay:120ms] lg:grid-cols-[380px_1fr]">
        <div className="flex flex-col gap-5">
          <Panel title="Client brief">
            <p className="tint-lavender whitespace-pre-wrap rounded-2xl p-4 text-sm leading-relaxed">{lead.brief || "No brief text."}</p>
          </Panel>
          <Panel title="About the lead">
            <dl className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-1">
              <Fact label="Client">{fullName(lead)}</Fact>
              <Fact label="Service interest">{lead.service}</Fact>
              <Fact label="Estimated budget">{lead.budget}</Fact>
              <Fact label="Location">{lead.location}</Fact>
            </dl>
            {lead.details && (
              <div className="mt-4">
                <div className="text-xs font-medium text-muted">Project details</div>
                <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-ink/75">{lead.details}</p>
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
