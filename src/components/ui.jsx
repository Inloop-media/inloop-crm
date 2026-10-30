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
const AVATAR_TINTS = ["#8b93ff", "#22d3ee", "#f472b6", "#fbbf24", "#4ade80", "#fb923c", "#a78bfa", "#38bdf8"];
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

export function Panel({ title, sub, action, children, className = "", bodyClass = "", id }) {
  return (
    <section id={id} className={`card flex min-w-0 flex-col p-5 sm:p-6 ${className}`}>
      {(title || action) && (
        <header className="mb-5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-medium tracking-[-0.015em] sm:text-[21px]">{title}</h2>
            {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
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
    <header className="rise mb-6">
      {back && (
        <Link href={back.href} className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-panel px-3 py-1.5 text-xs font-medium text-muted shadow-[var(--card-shadow)] transition hover:text-ink">
          <Icon name="back" size={13} /> {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="min-w-0">
          {kicker && <p className="text-sm text-muted">{kicker}</p>}
          {title && <h1 className="page-title mt-1">{title}</h1>}
          {sub && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{sub}</p>}
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

/** A small headline number for the top of a page: label, value, coloured change badge. */
export function Stat({ label, value, sub, delta, className = "" }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <div className="truncate text-xs text-muted">{label}</div>
      <div className="mt-1 flex items-center gap-2">
        <span className="text-[30px] font-medium leading-none tracking-[-0.02em] sm:text-[36px]">{value}</span>
        {delta != null && (
          <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.3)] ${delta >= 0 ? "bg-emerald-500 shadow-emerald-500/40" : "bg-rose-500 shadow-rose-500/40"}`}>
            {delta >= 0 ? "+" : "−"}
            {Math.abs(delta)}%
          </span>
        )}
      </div>
      {sub && <div className="mt-1 truncate text-[11px] text-faint">{sub}</div>}
    </div>
  );
}

export function Empty({ icon = "check", children }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-8 text-center text-sm text-muted">
      <span className="grid h-11 w-11 place-items-center rounded-2xl bg-panel-2 text-faint">
        <Icon name={icon} size={17} />
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
