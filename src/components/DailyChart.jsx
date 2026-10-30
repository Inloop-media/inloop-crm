"use client";

import { useState } from "react";

/** Leads per day — one hue, thin bars anchored to the baseline, hover for the exact count. */
export default function DailyChart({ days }) {
  const [hover, setHover] = useState(null);
  const max = Math.max(1, ...days.map((d) => d.count));
  const total = days.reduce((n, d) => n + d.count, 0);
  const active = hover == null ? null : days[hover];

  return (
    <div className="flex h-full flex-1 flex-col">
      <div className="mb-3 flex h-5 items-baseline justify-between text-xs text-muted">
        <span>{active ? active.label : `${days[0]?.label} – ${days.at(-1)?.label}`}</span>
        <span className="tabular-nums text-ink">{active ? `${active.count} lead${active.count === 1 ? "" : "s"}` : `${total} total`}</span>
      </div>
      <div className="relative min-h-52 flex-1" onMouseLeave={() => setHover(null)}>
        {/* recessive gridlines at 0, half and max */}
        {(max > 1 ? [0, 0.5, 1] : [0, 1]).map((f) => (
          <div key={f} className="absolute inset-x-0 border-t border-dashed border-white/[0.06]" style={{ bottom: `${f * 100}%` }}>
            {f > 0 && <span className="absolute -top-2 right-0 pl-1 text-[10px] tabular-nums text-faint">{Math.round(max * f)}</span>}
          </div>
        ))}
        <div className="absolute inset-0 flex items-end gap-[2px] pr-6">
          {days.map((d, i) => (
            <div
              key={d.key}
              onMouseEnter={() => setHover(i)}
              className="flex h-full flex-1 cursor-default items-end justify-center"
              aria-label={`${d.label}: ${d.count}`}
            >
              <div
                className="w-full max-w-[14px] rounded-t-[4px] transition-colors"
                style={{
                  height: d.count ? `${Math.max(4, (d.count / max) * 100)}%` : "2px",
                  background: d.count
                    ? `linear-gradient(180deg, ${hover === i ? "#e0e7ff" : "var(--color-brand-soft)"}, color-mix(in srgb, var(--color-brand) 35%, transparent))`
                    : "var(--color-line-strong)",
                  boxShadow: d.count && hover === i ? "0 0 18px rgb(129 140 248 / 0.6)" : "none",
                  opacity: hover == null || hover === i ? 1 : 0.55,
                }}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2 flex justify-between pr-6 text-[10px] text-faint">
        <span>{days[0]?.label}</span>
        <span>{days[Math.floor(days.length / 2)]?.label}</span>
        <span>Today</span>
      </div>
    </div>
  );
}
