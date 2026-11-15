import Icon from "@/components/Icon";
import BriefCard from "@/components/BriefCard";
import { Empty } from "@/components/ui";
import { FilterPills, PageTop } from "@/components/Desk";
import { requireMember } from "@/lib/auth";
import { listProposals } from "@/lib/leads";
import { canSeeAllLeads, canSeeBriefs } from "@/lib/permissions";

export const metadata = { title: "Briefs" };

export default async function BriefsPage({ searchParams }) {
  const me = await requireMember(canSeeBriefs);
  const staff = canSeeAllLeads(me);
  const { tab } = await searchParams;
  const all = await listProposals(me);
  const tabs = [
    { id: "open", label: "Open", items: all.filter((p) => !p.strategist_id) },
    { id: "mine", label: staff ? "In progress" : "My briefs", items: all.filter((p) => p.strategist_id && (staff || p.strategist_id === me.id) && p.stage !== "done") },
    { id: "done", label: "Delivered", items: all.filter((p) => p.stage === "done") },
  ];
  const current = tabs.find((t) => t.id === tab) || tabs.find((t) => t.items.length) || tabs[0];
  const hrefFor = (p) => (staff ? `/leads/${p.lead.id}#proposal` : `/briefs/${p.lead.id}`);

  return (
    <div className="page">
      <PageTop
        title="Proposals"
        sub={`${tabs[0].items.length} open · ${tabs[1].items.length} in progress · ${tabs[2].items.length} delivered`}
        right={<FilterPills items={tabs.map((t) => ({ label: t.label, count: t.items.length, href: `/briefs?tab=${t.id}`, on: current.id === t.id }))} />}
      />
      <p className="rise -mt-2 mb-5 max-w-3xl text-[13px] text-muted">
        A brief lands here when the proposal meeting is booked. Pick one up, upload the reference links, creatives, brand strategy and brand identity — the CRL bot takes it from there.
      </p>

      {current.items.length ? (
        <div className="rise grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {current.items.map((p) => (
            <BriefCard key={p.id} p={p} href={hrefFor(p)} />
          ))}
        </div>
      ) : (
        <div className="card">
          <Empty icon="brief">{current.id === "open" ? "No open briefs right now." : "Nothing here yet."}</Empty>
        </div>
      )}
      {!staff && (
        <p className="mt-6 flex items-center gap-2 text-xs text-faint">
          <Icon name="alert" size={13} /> Once you pick a brief up it&apos;s yours — the other strategists stop seeing it.
        </p>
      )}
    </div>
  );
}
