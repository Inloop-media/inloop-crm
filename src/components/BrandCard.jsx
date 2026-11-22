// A brand as a calm card: its mark and name, the services we do for them, four small numbers
// (in work, to check, late, approved) and a thin line for how much of the work is approved.
// Brands still onboarding show where the MOU stands instead.
import Link from "next/link";
import Icon from "@/components/Icon";
import { BrandMark } from "@/components/ui";
import { BRAND_STAGES } from "@/lib/constants";
import { fmtDay } from "@/lib/format";

function Stat({ label, value, tone }) {
  return (
    <span className={`flex flex-col items-center rounded-xl bg-panel-2 py-2 text-center ${value ? "" : "opacity-50"}`}>
      <span className={`text-[15px] font-medium tabular-nums ${value && tone === "red" ? "text-rose-500" : value && tone === "amber" ? "text-amber-500" : ""}`}>{value || 0}</span>
      <span className="text-[10px] text-muted">{label}</span>
    </span>
  );
}

export default function BrandCard({ b, unread = 0 }) {
  const c = b.counts || {};
  const stage = BRAND_STAGES[b.stage];
  const active = b.stage === "active";
  const href = active ? `/brands/${b.id}` : `/leads/${b.lead?.id}#onboarding`;
  const pct = c.total ? Math.round((c.done / c.total) * 100) : 0;
  const services = b.services || [];

  return (
    <Link href={href} className="card card-hover group flex flex-col gap-4 p-4">
      <div className="flex items-start gap-3">
        <BrandMark name={b.name} size={44} />
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="truncate text-[15px] font-medium group-hover:text-brand">{b.name}</div>
          <div className="mt-0.5 text-[11.5px] text-muted">
            {active ? (c.total ? `${c.total} task${c.total === 1 ? "" : "s"} so far` : "No tasks yet") : stage?.label || "Onboarding"}
          </div>
        </div>
        {unread > 0 ? (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-brand px-2 py-1 text-[10px] font-semibold text-white" title="Unread messages">
            <Icon name="chat" size={11} /> {unread}
          </span>
        ) : (
          !active && <span className="shrink-0 rounded-full bg-amber-500/12 px-2 py-0.5 text-[10.5px] font-medium text-amber-600 dark:text-amber-400">Onboarding</span>
        )}
      </div>

      {services.length > 0 && (
        <div className="-mt-1 flex flex-wrap gap-1">
          {services.slice(0, 3).map((s) => (
            <span key={s.name} className="rounded-full border border-line px-2 py-0.5 text-[10.5px] text-muted">
              {s.name}
            </span>
          ))}
          {services.length > 3 && <span className="px-1 py-0.5 text-[10.5px] text-faint">+{services.length - 3}</span>}
        </div>
      )}

      {active ? (
        <div className="grid grid-cols-4 gap-1.5">
          <Stat label="In work" value={c.open} />
          <Stat label="To check" value={c.review} tone="amber" />
          <Stat label="Late" value={c.overdue} tone="red" />
          <Stat label="Approved" value={c.done} />
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-xl bg-panel-2 px-3 py-2.5 text-[12px] text-muted">
          <Icon name={b.stage === "mou_sent" ? "mail" : "file"} size={14} className="text-brand" />
          {b.stage === "mou_sent" ? `MOU sent ${fmtDay(b.mou_sent_at)}` : "MOU being drafted"}
        </div>
      )}

      <div className="mt-auto flex items-center gap-3">
        {active && c.total > 0 ? (
          <>
            <span className="block h-1 flex-1 overflow-hidden rounded-full bg-panel-2">
              <span className="block h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
            </span>
            <span className="shrink-0 text-[11px] tabular-nums text-muted">{pct}% approved</span>
          </>
        ) : (
          <span className="flex-1" />
        )}
        <span className="flex shrink-0 items-center gap-1 text-[12px] font-medium opacity-0 transition group-hover:opacity-100">
          Open <Icon name="arrow" size={12} />
        </span>
      </div>
    </Link>
  );
}
