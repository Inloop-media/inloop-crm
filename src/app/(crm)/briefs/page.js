import Link from "next/link";
import Icon from "@/components/Icon";
import BriefCard from "@/components/BriefCard";
import { Empty, PageHeader } from "@/components/ui";
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
      <PageHeader
        kicker="Creative strategy"
        title="Briefs"
        sub="A brief lands here when the proposal meeting is booked. Pick one up, upload the reference links, creatives, brand strategy and brand identity — the CRL bot takes it from there."
      />

      <nav className="seg rise rise-1 mb-5 flex w-full p-1.5 sm:w-fit">
        {tabs.map((t) => (
          <Link
            key={t.id}
            href={`/briefs?tab=${t.id}`}
            data-on={current.id === t.id}
            className="seg-item flex flex-1 items-center justify-center gap-2 sm:flex-none"
          >
            {t.label}
            <span className="rounded-full bg-panel-2 px-1.5 text-[11px] tabular-nums text-muted">{t.items.length}</span>
          </Link>
        ))}
      </nav>

      {current.items.length ? (
        <div className="rise rise-2 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
