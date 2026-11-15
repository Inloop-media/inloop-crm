// Small building blocks shared by the dashboard and the brief pages (server-safe, no hooks).
import Link from "next/link";
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
const AVATAR_TINTS = ["#e8654f", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#64748b"];
const tint = (s) => AVATAR_TINTS[[...String(s || "")].reduce((n, c) => n + c.charCodeAt(0), 0) % AVATAR_TINTS.length];

export function Avatar({ name, size = 28 }) {
  const c = tint(name);
  return (
    <span
      title={name}
      className="grid shrink-0 place-items-center rounded-full font-semibold shadow-[inset_0_1px_0_rgb(255_255_255/0.35),0_2px_6px_-2px_rgb(23_22_29/0.15)] ring-2 ring-panel"
      style={{ width: size, height: size, fontSize: size * 0.38, background: `${c}26`, color: `color-mix(in oklab, ${c} 70%, var(--color-ink))` }}
    >
      {initials(name)}
    </span>
  );
}

export function Panel({ title, sub, action, children, className = "", bodyClass = "", id, icon }) {
  return (
    <section id={id} className={`card flex min-w-0 flex-col p-5 sm:p-6 ${className}`}>
      {(title || action) && (
        <header className="mb-5 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {icon && (
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-line bg-panel-2 text-ink/70">
                <Icon name={icon} size={16} />
              </span>
            )}
            <div className="min-w-0">
              <h2 className="text-[17px] font-medium leading-tight tracking-[-0.02em] sm:text-lg">{title}</h2>
              {sub && <p className="mt-1 text-[12.5px] leading-snug text-muted">{sub}</p>}
            </div>
          </div>
          {action}
        </header>
      )}
      <div className={`min-h-0 flex-1 ${bodyClass}`}>{children}</div>
    </section>
  );
}

/** The top of every page: optional back link, a small kicker, the title, a line of context, actions. */
export function PageHeader({ back, kicker, title, sub, actions, children }) {
  return (
    <header className="rise mb-7">
      {back && (
        <Link href={back.href} className="group mb-5 inline-flex items-center gap-1.5 rounded-full border border-line bg-panel py-1.5 pl-2 pr-3.5 text-xs font-medium text-muted shadow-[var(--card-shadow)] transition hover:text-ink">
          <span className="grid h-5 w-5 place-items-center rounded-full bg-panel-2 transition group-hover:-translate-x-0.5">
            <Icon name="back" size={11} />
          </span>
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="min-w-0">
          {kicker && (
            <p className="mb-2.5 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-brand shadow-[0_0_0_3px_rgb(232_101_79/0.18)]" />
              {kicker}
            </p>
          )}
          {title && <h1 className="page-title">{title}</h1>}
          {sub && <p className="mt-2.5 max-w-2xl text-[14px] leading-relaxed text-muted">{sub}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </header>
  );
}

/** Round hairline button in a card's corner (expand, filter, add). */
export function CornerLink({ href, icon = "expand", label }) {
  return (
    <Link href={href} title={label} aria-label={label} className="icon-btn">
      <Icon name={icon} size={15} />
    </Link>
  );
}

/** Headline numbers side by side in one card, split by hairlines: icon, label, value, change badge. */
export function StatStrip({ items, className = "" }) {
  return (
    <div className={`card grid grid-cols-2 gap-y-4 p-4 sm:flex sm:gap-0 sm:divide-x sm:divide-line sm:px-2 sm:py-4 ${className}`}>
      {items.map((it) => (
        <div key={it.label} className="flex min-w-0 items-center gap-3 px-2 sm:px-5">
          <span className={`tint-${it.tint || "lavender"} grid h-10 w-10 shrink-0 place-items-center rounded-xl text-ink`}>
            <Icon name={it.icon || "chart"} size={16} />
          </span>
          <div className="min-w-0">
            <div className="truncate text-xs text-muted">{it.label}</div>
            <div className="mt-0.5 flex items-center gap-2">
              <span className="text-[26px] font-medium leading-none tracking-[-0.02em]">{it.value}</span>
              {it.delta != null && (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${it.delta >= 0 ? "bg-emerald-400/15 text-emerald-400" : "bg-rose-400/15 text-rose-400"}`}>
                  {it.delta >= 0 ? "↑" : "↓"} {Math.abs(it.delta)}%
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function Empty({ icon = "check", children }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3.5 px-6 py-10 text-center text-[13px] leading-relaxed text-muted">
      <span className="relative grid h-14 w-14 place-items-center">
        <span className="absolute inset-0 rounded-full border border-dashed border-line-strong" />
        <span className="grid h-10 w-10 place-items-center rounded-full bg-panel-2 text-ink/50 shadow-[inset_0_1px_0_rgb(255_255_255/0.6)]">
          <Icon name={icon} size={17} />
        </span>
      </span>
      <div className="max-w-xs">{children}</div>
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
        const color = here && info.error ? "bg-rose-400" : done ? "bg-solid" : here ? "bg-brand animate-pulse" : "bg-panel-3";
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
    ? "bg-rose-400/12 text-rose-400"
    : stage === "done"
      ? "bg-emerald-400/12 text-emerald-400"
      : stage === "awaiting_commercials"
        ? "bg-amber-400/15 text-amber-300"
        : "bg-brand/12 text-brand";
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${tone}`}>
      <span className={`h-1.5 w-1.5 rounded-full bg-current ${/queued|running/.test(stage) ? "animate-pulse" : ""}`} />
      {info.label}
    </span>
  );
}

/** A brand's mark: a rounded square in the brand's colour with its first letter (sidebar, workspace header). */
export function BrandMark({ name, size = 20 }) {
  const c = tint(name);
  return (
    <span
      className="grid shrink-0 place-items-center font-semibold"
      style={{
        width: size,
        height: size,
        borderRadius: Math.max(6, size * 0.3),
        fontSize: size * 0.44,
        background: `linear-gradient(160deg, color-mix(in srgb, ${c} 30%, white), color-mix(in srgb, ${c} 55%, white))`,
        color: `color-mix(in oklab, ${c} 45%, #141416)`,
        boxShadow: `inset 0 1px 0 rgb(255 255 255 / 0.6), 0 0 0 1px color-mix(in srgb, ${c} 30%, transparent)`,
      }}
    >
      {String(name || "?").trim()[0]?.toUpperCase()}
    </span>
  );
}

/**
 * A number card: label on top, a big light number underneath. `coral` makes it the screen's one
 * highlight card; `bar` (0–100) adds a small progress line with a hatched remainder.
 */
export function StatCard({ href, label, value, note, coral = false, bar, tone }) {
  const body = (
    <>
      <span className="flex items-start justify-between gap-2">
        <span className="text-sm">{label}</span>
        {href && <Icon name="arrow" size={14} className="-rotate-45 opacity-0 transition group-hover:opacity-60" />}
      </span>
      <span className="flex items-end justify-between gap-3">
        <span className="text-[44px] font-light leading-none tracking-[-0.04em] tabular-nums" style={!coral && value && tone ? { color: tone } : undefined}>
          {value}
        </span>
        {note && <span className="hidden truncate pb-1 text-xs text-muted sm:block">{note}</span>}
      </span>
      {bar !== undefined && (
        <span className="flex h-1.5 gap-1">
          <span className="rounded-full bg-brand" style={{ width: `${Math.max(4, bar)}%` }} />
          <span className="hatch flex-1 rounded-full" />
        </span>
      )}
    </>
  );
  const cls = `group flex min-h-[132px] flex-col justify-between gap-3 p-5 transition duration-300 hover:-translate-y-0.5 ${coral ? "card-coral" : "card"}`;
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
