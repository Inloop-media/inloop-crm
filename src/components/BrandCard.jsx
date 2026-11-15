import Link from "next/link";
import Icon from "@/components/Icon";
import { Avatar, BrandMark } from "@/components/ui";
import { Progress } from "@/components/Tasks";
import { BRAND_STAGES } from "@/lib/constants";
import { fmtDay } from "@/lib/format";

export default function BrandCard({ b, unread = 0 }) {
  const c = b.counts;
  const stage = BRAND_STAGES[b.stage];
  const href = b.stage === "active" ? `/brands/${b.id}` : `/leads/${b.lead?.id}#onboarding`;
  return (
    <Link href={href} className="card card-hover group flex flex-col gap-5 p-6">
      <div className="flex items-start gap-3">
        <BrandMark name={b.name} size={44} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-lg font-medium tracking-[-0.01em]">{b.name}</div>
          <div className="truncate text-xs text-muted">{(b.services || []).map((s) => s.name).join(" · ") || "No services listed"}</div>
        </div>
        {unread > 0 ? (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-400/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-500">
            <Icon name="chat" size={12} /> {unread} new
          </span>
        ) : (
          <span className={`tint-${stage.tint} shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium`}>{stage.label}</span>
        )}
      </div>
      {b.stage === "active" ? (
        <>
          <Progress done={c.done} total={c.total} />
          <div className="grid grid-cols-4 gap-2 text-center">
            {[
              ["In work", c.open, ""],
              ["Review", c.review, ""],
              ["Client", c.client, ""],
              ["Overdue", c.overdue, c.overdue ? "text-rose-400" : ""],
            ].map(([l, v, cls]) => (
              <div key={l} className="well px-1 py-2">
                <div className={`text-base font-medium ${cls}`}>{v}</div>
                <div className="text-[10px] text-muted">{l}</div>
              </div>
            ))}
          </div>
          {b.assigners?.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
              <span>Assigned by</span>
              {b.assigners.map(([name, n]) => (
                <span key={name} className="inline-flex items-center gap-1 rounded-full bg-panel-2 py-0.5 pl-0.5 pr-2">
                  <Avatar name={name} size={16} />
                  {name.split(" ")[0]} <b className="font-semibold text-ink">{n}</b>
                </span>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between text-xs text-muted">
            <span>Onboarded {fmtDay(b.onboarded_at)}</span>
            <Icon name="arrow" size={14} className="transition group-hover:translate-x-1" />
          </div>
        </>
      ) : (
        <div className="well flex items-center justify-between p-3.5 text-xs text-muted">
          {b.stage === "mou_sent" ? `MOU sent ${fmtDay(b.mou_sent_at)} — waiting for the signature` : "MOU being drafted"}
          <Icon name="arrow" size={14} />
        </div>
      )}
    </Link>
  );
}

