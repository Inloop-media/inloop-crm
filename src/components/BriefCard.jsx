import Link from "next/link";
import { Avatar, StagePill, StepTrack } from "@/components/ui";
import { ago, fullName } from "@/lib/format";

export default function BriefCard({ p, href }) {
  return (
    <Link href={href} className="card card-hover group flex flex-col gap-4 p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="code">{p.lead.code}</span>
          <div className="mt-2.5 truncate text-lg font-medium tracking-[-0.01em]">{p.lead.brand || fullName(p.lead)}</div>
          <div className="truncate text-xs text-muted">{[p.lead.service, p.lead.budget].filter(Boolean).join(" · ") || "—"}</div>
        </div>
        <StagePill stage={p.stage} />
      </div>
      <p className="well line-clamp-3 min-h-[5.5em] whitespace-pre-line p-3.5 text-sm leading-relaxed text-ink/75">{p.lead.brief || "No brief text."}</p>
      <StepTrack stage={p.stage} compact />
      <div className="flex items-center justify-between pt-1 text-xs text-muted">
        <span className="flex items-center gap-2">
          {p.strategist ? (
            <>
              <Avatar name={p.strategist.name} size={22} /> {p.strategist.name}
            </>
          ) : (
            <span className="rounded-full bg-brand px-2.5 py-1 font-medium text-on-brand">Open — pick it up</span>
          )}
        </span>
        <span>Shared {ago(p.shared_at)}</span>
      </div>
    </Link>
  );
}

