// Small building blocks shared by the dashboard and the brief pages (server-safe, no hooks).
import Icon from "@/components/Icon";
import { PROPOSAL_STAGES, PROPOSAL_STEPS } from "@/lib/constants";

export const initials = (name) =>
  String(name || "?")
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

// Stable colour per person, so the same teammate always gets the same avatar
const AVATAR_TINTS = ["#8b93ff", "#22d3ee", "#f472b6", "#fbbf24", "#4ade80", "#fb923c", "#a78bfa", "#38bdf8"];
const tint = (s) => AVATAR_TINTS[[...String(s || "")].reduce((n, c) => n + c.charCodeAt(0), 0) % AVATAR_TINTS.length];

export function Avatar({ name, size = 28 }) {
  const c = tint(name);
  return (
    <span
      title={name}
      className="grid shrink-0 place-items-center rounded-full font-semibold ring-2 ring-bg"
      style={{ width: size, height: size, fontSize: size * 0.38, background: `${c}26`, color: `color-mix(in oklab, ${c} 70%, var(--color-ink))` }}
    >
      {initials(name)}
    </span>
  );
}

export function Panel({ title, sub, action, children, className = "", bodyClass = "" }) {
  return (
    <section className={`card flex min-w-0 flex-col p-4 sm:p-6 ${className}`}>
      {(title || action) && (
        <header className="mb-4 flex items-start justify-between gap-3 sm:mb-5">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold tracking-[-0.01em]">{title}</h2>
            {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={`min-h-0 flex-1 ${bodyClass}`}>{children}</div>
    </section>
  );
}

/** A single trend line, no axes — the number beside it is the headline. */
export function Sparkline({ values, width = 104, height = 36 }) {
  if (!values?.length) return null;
  const max = Math.max(1, ...values);
  const step = width / Math.max(1, values.length - 1);
  const pts = values.map((v, i) => [i * step, height - 3 - (v / max) * (height - 6)]);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const last = pts.at(-1);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible" aria-hidden="true">
      <defs>
        <linearGradient id="spark-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="var(--color-brand)" stopOpacity="0.32" />
          <stop offset="1" stopColor="var(--color-brand)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${width},${height} L0,${height} Z`} fill="url(#spark-fill)" />
      <path d={line} fill="none" stroke="var(--color-brand-soft)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r="6" fill="var(--color-brand)" opacity="0.25" />
      <circle cx={last[0]} cy={last[1]} r="3" fill="var(--color-brand-soft)" stroke="var(--color-bg)" strokeWidth="1.5" />
    </svg>
  );
}

// Each KPI gets its own glow so a row of them doesn't read as four identical boxes
const STAT_TONES = {
  brand: { glow: "bg-brand/25", icon: "bg-brand/12 text-brand-soft ring-brand/25" },
  cyan: { glow: "bg-cyan-400/20", icon: "bg-cyan-400/10 text-cyan-300 ring-cyan-400/25" },
  amber: { glow: "bg-amber-400/20", icon: "bg-amber-400/10 text-amber-300 ring-amber-400/25" },
  emerald: { glow: "bg-emerald-400/20", icon: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/25" },
  fuchsia: { glow: "bg-fuchsia-400/20", icon: "bg-fuchsia-400/10 text-fuchsia-300 ring-fuchsia-400/25" },
};

export function Stat({ label, value, sub, delta, spark, icon, tone = "brand", className = "" }) {
  const t = STAT_TONES[tone] || STAT_TONES.brand;
  return (
    <div className={`card card-hover group relative overflow-hidden p-4 sm:p-5 ${className}`}>
      <span className={`pointer-events-none absolute -right-12 -top-14 h-36 w-36 rounded-full blur-3xl transition-opacity duration-500 group-hover:opacity-100 ${t.glow} opacity-60`} />
      <div className="relative flex items-center justify-between gap-2">
        <span className="eyebrow truncate tracking-[0.08em] sm:tracking-[0.16em]">{label}</span>
        {icon && (
          <span className={`hidden h-8 w-8 shrink-0 place-items-center rounded-xl ring-1 ring-inset sm:grid ${t.icon}`}>
            <Icon name={icon} size={15} />
          </span>
        )}
      </div>
      <div className="relative mt-4 flex items-end justify-between gap-3 sm:mt-6">
        <div className="min-w-0">
          <div className="num text-[44px] leading-[0.9] sm:text-[56px]">{value}</div>
          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
            {delta != null && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[11px] font-medium tabular-nums ring-1 ring-inset ${
                  delta >= 0 ? "bg-emerald-400/10 text-emerald-300 ring-emerald-400/20" : "bg-rose-400/10 text-rose-300 ring-rose-400/20"
                }`}
              >
                {delta >= 0 ? "↑" : "↓"} {Math.abs(delta)}%
              </span>
            )}
            {sub}
          </div>
        </div>
        {spark && (
          <span className="hidden sm:block">
            <Sparkline values={spark} />
          </span>
        )}
      </div>
    </div>
  );
}

export function Empty({ icon = "check", children }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-center text-sm text-muted">
      <span className="relative grid h-12 w-12 place-items-center rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.06] to-transparent text-brand-soft shadow-[inset_0_1px_0_rgb(255_255_255/0.08)]">
        <span className="absolute inset-0 rounded-2xl bg-brand/10 blur-xl" />
        <Icon name={icon} size={18} className="relative" />
      </span>
      {children}
    </div>
  );
}

/** Brief → Documents → CRL → Commercials → Strategy & deck → Ready, with the current step lit. */
export function StepTrack({ stage, compact = false }) {
  const info = PROPOSAL_STAGES[stage] || PROPOSAL_STAGES.brief_shared;
  const current = info.step;
  return (
    <ol className={`flex items-center ${compact ? "gap-1" : "gap-1.5"}`}>
      {PROPOSAL_STEPS.map((label, i) => {
        const done = i < current || stage === "done";
        const here = i === current && stage !== "done";
        const color = here && info.error ? "bg-rose-400" : done ? "bg-brand" : here ? "bg-brand/70 animate-pulse" : "bg-panel-3";
        return (
          <li key={label} className="flex min-w-0 flex-1 flex-col gap-1.5" title={label}>
            <span className={`h-1 rounded-full ${color}`} />
            {!compact && <span className={`truncate text-[10px] ${here || done ? "text-ink/80" : "text-faint"}`}>{label}</span>}
          </li>
        );
      })}
    </ol>
  );
}

export function StagePill({ stage }) {
  const info = PROPOSAL_STAGES[stage] || PROPOSAL_STAGES.brief_shared;
  const tone = info.error
    ? "border-rose-400/30 bg-rose-400/10 text-rose-300"
    : stage === "done"
      ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
      : stage === "awaiting_commercials"
        ? "border-amber-400/30 bg-amber-400/10 text-amber-200"
        : "border-brand/30 bg-brand/10 text-brand";
  return <span className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${tone}`}>{info.label}</span>;
}
