// A brand card in the Overview's bold style: mark, name, a round arrow, the approved share as a thick
// coral bar with a hatched rest, and three small tiles (in work / to check / late). `dark` makes it the
// screen's black highlight card (the busiest client). Brands still onboarding show where the MOU stands.
import Link from "next/link";
import Icon from "@/components/Icon";
import { BrandMark } from "@/components/ui";
import { DARK, HatchBar, RoundLink } from "@/components/Bold";
import { BRAND_STAGES } from "@/lib/constants";
import { fmtDay } from "@/lib/format";

export default function BrandCard({ b, unread = 0, dark = false }) {
  const c = b.counts || {};
  const active = b.stage === "active";
  const href = active ? `/brands/${b.id}` : `/leads/${b.lead?.id}#onboarding`;
  const total = c.total || 0;
  const pct = total ? Math.round(((c.done || 0) / total) * 100) : 0;
  const services = b.services || [];
  const tile = dark ? "bg-white/10" : "bg-panel-2";
  const muted = dark ? "text-white/60" : "text-muted";

  return (
    <Link
      href={href}
      className={`group flex flex-col p-5 transition duration-300 hover:-translate-y-1 ${dark ? DARK : "card hover:shadow-[0_20px_40px_-22px_rgb(0_0_0/0.3)]"}`}
    >
      <div className="flex items-start gap-3">
        <BrandMark name={b.name} size={40} />
        <div className="min-w-0 flex-1">
          {dark && (
            <span className="mb-0.5 flex items-center gap-1.5 text-[11px] text-white/60">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" /> Busiest client
            </span>
          )}
          <div className="truncate text-[16px] font-medium tracking-[-0.01em]">{b.name}</div>
          <div className={`text-[11.5px] ${muted}`}>{active ? (total ? `${total} task${total === 1 ? "" : "s"} so far` : "No tasks yet") : BRAND_STAGES[b.stage]?.label || "Onboarding"}</div>
        </div>
        {unread > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-brand px-2 py-1 text-[10px] font-semibold text-white" title="Unread messages">
            <Icon name="chat" size={11} /> {unread}
          </span>
        )}
        <RoundLink as="span" light={dark} />
      </div>

      {services.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {services.slice(0, 3).map((s) => (
            <span key={s.name} className={`rounded-full px-2 py-0.5 text-[10.5px] ${dark ? "bg-white/10 text-white/80" : "bg-panel-2 text-muted"}`}>
              {s.name}
            </span>
          ))}
          {services.length > 3 && <span className={`px-1 py-0.5 text-[10.5px] ${muted}`}>+{services.length - 3}</span>}
        </div>
      )}

      {!active ? (
        <div className="mt-auto pt-5">
          <div className="flex items-center gap-3 rounded-2xl bg-amber-500/10 p-3 text-[12px] text-amber-700 dark:text-amber-300">
            <Icon name={b.stage === "mou_sent" ? "mail" : "file"} size={15} />
            {b.stage === "mou_sent" ? `MOU sent ${fmtDay(b.mou_sent_at)}` : "MOU being drafted"}
          </div>
        </div>
      ) : (
        <div className="mt-auto pt-5">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="flex items-baseline gap-1.5">
              <span className="text-[30px] font-light leading-none tabular-nums tracking-[-0.03em]">{pct}%</span>
              <span className={`text-[11px] ${muted}`}>approved</span>
            </span>
            <span className={`text-[11px] tabular-nums ${muted}`}>
              {c.done || 0}/{total}
            </span>
          </div>
          <HatchBar pct={pct} className="h-2.5" light={dark} />
          <div className="mt-3 grid grid-cols-3 gap-1.5">
            {[
              ["In work", c.open || 0, ""],
              ["To check", c.review || 0, "text-amber-500"],
              ["Late", c.overdue || 0, "text-rose-500"],
            ].map(([l, v, tone]) => (
              <span key={l} className={`flex items-center justify-between rounded-xl px-2.5 py-2 text-[10.5px] ${tile} ${muted}`}>
                {l}
                <b className={`text-[13px] font-medium tabular-nums ${v && tone ? tone : dark ? "text-white" : "text-ink"}`}>{v}</b>
              </span>
            ))}
          </div>
        </div>
      )}
    </Link>
  );
}
