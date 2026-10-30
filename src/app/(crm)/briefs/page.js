import Link from "next/link";
import Icon from "@/components/Icon";
import { Avatar, Empty, StagePill, StepTrack } from "@/components/ui";
import { requireMember } from "@/lib/auth";
import { listProposals } from "@/lib/leads";
import { canSeeAllLeads, canSeeBriefs } from "@/lib/permissions";
import { ago, fullName } from "@/lib/format";

export const metadata = { title: "Briefs" };

function BriefCard({ p, href }) {
  return (
    <Link href={href} className="card card-hover group flex flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="rounded-md bg-panel-2 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-muted">{p.lead.code}</span>
          <div className="mt-2 truncate text-[17px] font-semibold tracking-[-0.01em]">{p.lead.brand || fullName(p.lead)}</div>
          <div className="truncate text-xs text-muted">{[p.lead.service, p.lead.budget].filter(Boolean).join(" · ") || "—"}</div>
        </div>
        <StagePill stage={p.stage} />
      </div>
      <p className="line-clamp-3 min-h-[3.75em] whitespace-pre-line text-sm leading-relaxed text-ink/70">{p.lead.brief || "No brief text."}</p>
      <StepTrack stage={p.stage} compact />
      <div className="flex items-center justify-between border-t border-line pt-3.5 text-xs text-muted">
        <span className="flex items-center gap-2">
          {p.strategist ? (
            <>
              <Avatar name={p.strategist.name} size={22} /> {p.strategist.name}
            </>
          ) : (
            <span className="text-brand">Open — pick it up</span>
          )}
        </span>
        <span>Shared {ago(p.shared_at)}</span>
      </div>
    </Link>
  );
}

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
    <div className="relative z-[1] mx-auto max-w-[1320px] px-4 py-6 md:px-8 md:py-9">
      <header className="rise mb-7">
        <p className="eyebrow">Creative strategy</p>
        <h1 className="page-title mt-1.5"><em>Briefs</em></h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          A brief lands here when the proposal meeting is booked. Pick one up, upload the reference links, creatives, brand strategy and brand identity —
          the CRL bot takes it from there.
        </p>
      </header>

      <nav className="seg mb-5 flex w-full sm:w-fit">
        {tabs.map((t) => (
          <Link
            key={t.id}
            href={`/briefs?tab=${t.id}`}
            data-on={current.id === t.id}
            className="seg-item flex flex-1 items-center justify-center gap-2 sm:flex-none"
          >
            {t.label}
            <span className="text-xs tabular-nums text-faint">{t.items.length}</span>
          </Link>
        ))}
      </nav>

      {current.items.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
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
