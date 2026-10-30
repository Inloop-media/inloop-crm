"use client";

import { useState } from "react";

const W = 720;
const H = 230;
const PAD = { top: 16, right: 40, bottom: 8 };

// Smooth curve through the points that never overshoots them (monotone cubic, Fritsch–Carlson),
// so a single busy day doesn't swing the line below zero
function smooth(pts) {
  const n = pts.length;
  if (n < 2) return "";
  const dx = pts.slice(1).map((p, i) => p[0] - pts[i][0]);
  const m = pts.slice(1).map((p, i) => (p[1] - pts[i][1]) / dx[i]);
  const t = pts.map((_, i) => (i === 0 ? m[0] : i === n - 1 ? m[n - 2] : m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2));
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) {
      t[i] = t[i + 1] = 0;
      continue;
    }
    const a = t[i] / m[i];
    const b = t[i + 1] / m[i];
    const h = a * a + b * b;
    if (h > 9) {
      t[i] = (3 * a * m[i]) / Math.sqrt(h);
      t[i + 1] = (3 * b * m[i]) / Math.sqrt(h);
    }
  }
  let d = `M${pts[0][0]},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    const h = dx[i] / 3;
    d += ` C${(x0 + h).toFixed(1)},${(y0 + t[i] * h).toFixed(1)} ${(x1 - h).toFixed(1)},${(y1 - t[i + 1] * h).toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}`;
  }
  return d;
}

/** Leads per day as 3- and 7-day averages: two soft lines over a field of thin vertical strokes. */
export default function LeadsTrend({ days }) {
  const [hover, setHover] = useState(null);
  const counts = days.map((d) => d.count);
  // Rolling averages keep the lines calm; hovering shows the exact count for the day
  const rolling = (w) =>
    counts.map((_, i) => {
      const win = counts.slice(Math.max(0, i - w + 1), i + 1);
      return win.reduce((a, b) => a + b, 0) / win.length;
    });
  const short = rolling(3);
  const avg = rolling(7);
  const max = Math.max(2, Math.ceil(Math.max(...short)));
  const step = (W - PAD.right) / (days.length - 1);
  const y = (v) => PAD.top + (1 - v / max) * (H - PAD.top - PAD.bottom);
  const main = short.map((v, i) => [i * step, y(v)]);
  const mean = avg.map((v, i) => [i * step, y(v)]);
  const mainPath = smooth(main);
  const total = counts.reduce((a, b) => a + b, 0);
  const active = hover == null ? null : days[hover];

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-4 text-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-brand" /> New leads (3-day)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#f08bb5]" /> 7-day average
          </span>
        </div>
        <span className="tabular-nums text-muted">
          {active ? (
            <>
              {active.label} · <span className="font-medium text-ink">{active.count} lead{active.count === 1 ? "" : "s"}</span>
            </>
          ) : (
            <>
              <span className="font-medium text-ink">{total}</span> in 30 days
            </>
          )}
        </span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full overflow-visible" onMouseLeave={() => setHover(null)}>
        <defs>
          <pattern id="trend-lines" width="6" height="10" patternUnits="userSpaceOnUse">
            <rect width="1.2" height="10" fill="var(--color-brand)" />
          </pattern>
          <linearGradient id="trend-fade" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
            <stop offset="1" stopColor="#fff" stopOpacity="0.04" />
          </linearGradient>
          <mask id="trend-mask">
            <rect width={W} height={H} fill="url(#trend-fade)" />
          </mask>
        </defs>

        {/* recessive scale on the right */}
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1="0" x2={W - PAD.right} y1={y(max * f)} y2={y(max * f)} stroke="var(--color-line)" strokeDasharray="3 5" />
            <text x={W - 4} y={y(max * f) + 4} textAnchor="end" fontSize="11" fill="var(--color-faint)">
              {Math.round(max * f)}
            </text>
          </g>
        ))}

        <path d={`${mainPath} L${(days.length - 1) * step},${H} L0,${H} Z`} fill="url(#trend-lines)" mask="url(#trend-mask)" />
        <path d={smooth(mean)} fill="none" stroke="#f08bb5" strokeWidth="2" strokeLinecap="round" strokeDasharray="1 0" opacity="0.9" />
        <path d={mainPath} fill="none" stroke="var(--color-brand)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        {hover != null && (
          <g>
            <line x1={main[hover][0]} x2={main[hover][0]} y1={PAD.top} y2={H} stroke="var(--color-ink)" strokeOpacity="0.15" />
            <circle cx={main[hover][0]} cy={main[hover][1]} r="5" fill="var(--color-panel)" stroke="var(--color-brand)" strokeWidth="2.5" />
          </g>
        )}
        {days.map((d, i) => (
          <rect key={d.key} x={i * step - step / 2} y="0" width={step} height={H} fill="transparent" onMouseEnter={() => setHover(i)}>
            <title>{`${d.label}: ${d.count}`}</title>
          </rect>
        ))}
      </svg>

      <div className="mt-2 flex justify-between pr-10 text-[11px] text-faint">
        <span>{days[0]?.label}</span>
        <span>{days[Math.floor(days.length / 2)]?.label}</span>
        <span>Today</span>
      </div>
    </div>
  );
}
