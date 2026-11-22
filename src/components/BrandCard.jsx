// A brand as a premium card: a cover in the brand's colour with its mark, the name and services, one
// quiet line of the work that's actually there (in work · to check · late · approved) and a stacked bar.
// Brands still onboarding show where the MOU stands instead.
import Link from "next/link";
import Icon from "@/components/Icon";
import { BrandMark, brandBackdrop } from "@/components/ui";
import { BRAND_STAGES } from "@/lib/constants";
import { fmtDay } from "@/lib/format";

export default function BrandCard({ b, unread = 0 }) {
  const c = b.counts || {};
  const stage = BRAND_STAGES[b.stage];
  const active = b.stage === "active";
  const href = active ? `/brands/${b.id}` : `/leads/${b.lead?.id}#onboarding`;
  const total = c.total || 0;
  const pct = total ? Math.round(((c.done || 0) / total) * 100) : 0;
  const services = b.services || [];
  const late = c.overdue || 0;
  const stats = [
    ["In work", c.open, "bg-ink/70", ""],
    ["To check", c.review, "bg-amber-400", "text-amber-600 dark:text-amber-400"],
    ["Late", late, "bg-rose-500", "text-rose-500"],
    ["Approved", c.done, "bg-emerald-500", "text-emerald-600 dark:text-emerald-400"],
  ].filter(([, v]) => v > 0);

  return (
    <Link
      href={href}
      className="group card flex flex-col overflow-hidden !p-0 transition duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_-20px_rgb(0_0_0/0.35)]"
    >
      <div className="relative h-24 border-b border-line">
        <div className="h-full overflow-hidden">
          <div className="h-full transition duration-700 ease-out group-hover:scale-[1.05]" style={brandBackdrop(b.name)} />
        </div>
        <span className="absolute bottom-0 left-5 z-10 translate-y-1/2 rounded-[18px] bg-panel p-1 shadow-[0_10px_24px_-12px_rgb(0_0_0/0.35)]">
          <BrandMark name={b.name} size={46} />
        </span>
        <span className="absolute right-3 top-3 flex items-center gap-1.5">
          {unread > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-brand px-2 py-1 text-[10px] font-semibold text-white shadow-sm" title="Unread messages">
              <Icon name="chat" size={11} /> {unread}
            </span>
          )}
          {!active ? (
            <span className="rounded-full bg-amber-500/90 px-2 py-0.5 text-[10.5px] font-medium text-white shadow-sm">Onboarding</span>
          ) : late > 0 ? (
            <span className="rounded-full bg-panel/85 px-2 py-0.5 text-[10.5px] font-medium text-rose-500 shadow-sm backdrop-blur">{late} late</span>
          ) : null}
        </span>
      </div>

      <div className="flex flex-1 flex-col px-5 pb-4 pt-8">
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-[15.5px] font-medium tracking-[-0.01em]">{b.name}</span>
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-line text-muted transition group-hover:border-transparent group-hover:bg-solid group-hover:text-on-solid">
            <Icon name="arrow" size={12} className="-rotate-45" />
          </span>
        </div>
        <div className="mt-0.5 text-[12px] text-muted">
          {active ? (total ? `${total} task${total === 1 ? "" : "s"} so far` : "No tasks yet") : stage?.label || "Onboarding"}
        </div>

        {services.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {services.slice(0, 3).map((s) => (
              <span key={s.name} className="rounded-full bg-panel-2 px-2 py-0.5 text-[10.5px] text-muted">
                {s.name}
              </span>
            ))}
            {services.length > 3 && <span className="px-1 py-0.5 text-[10.5px] text-faint">+{services.length - 3}</span>}
          </div>
        )}

        <div className="mt-auto pt-4">
          {!active ? (
            <div className="flex items-center gap-2 border-t border-line pt-3 text-[12px] text-muted">
              <Icon name={b.stage === "mou_sent" ? "mail" : "file"} size={13} className="text-amber-500" />
              {b.stage === "mou_sent" ? `MOU sent ${fmtDay(b.mou_sent_at)}` : "MOU being drafted"}
            </div>
          ) : total ? (
            <div className="border-t border-line pt-3">
              <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-panel-2">
                {stats.map(([l, v, bar]) => (
                  <span key={l} className={`h-full ${bar}`} style={{ width: `${(v / total) * 100}%` }} />
                ))}
              </div>
              <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-muted">
                {stats.map(([l, v, , text]) => (
                  <span key={l}>
                    <b className={`font-medium tabular-nums ${text || "text-ink"}`}>{v}</b> {l.toLowerCase()}
                  </span>
                ))}
                <span className="ml-auto tabular-nums text-faint">{pct}%</span>
              </div>
            </div>
          ) : (
            <div className="border-t border-line pt-3 text-[11.5px] text-faint">Nothing in work yet</div>
          )}
        </div>
      </div>
    </Link>
  );
}
