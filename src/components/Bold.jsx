// The bold pieces of the admin Overview, shared by other pages (brands, library, brand plans):
// round arrow links, a gradient bar with a hatched remainder, the icon tile and the coral / dark cards.
import Link from "next/link";
import Icon from "@/components/Icon";

export function RoundLink({ href, icon = "arrow", label, light, as = "link" }) {
  const cls = `grid h-9 w-9 shrink-0 place-items-center rounded-full transition group-hover:-translate-y-0.5 ${light ? "bg-white/20 text-white hover:bg-white/30" : "border border-line bg-panel text-ink hover:bg-panel-2"}`;
  const icn = <Icon name={icon} size={14} className={icon === "arrow" ? "-rotate-45" : ""} />;
  if (as === "span")
    return (
      <span aria-hidden className={cls}>
        {icn}
      </span>
    );
  return (
    <Link href={href} aria-label={label} className={cls}>
      {icn}
    </Link>
  );
}

/** A thick bar: the done share in the coral gradient, the rest hatched. */
export function HatchBar({ pct, className = "h-3", light }) {
  return (
    <div className={`flex gap-1 ${className}`}>
      {pct > 0 && <span className={`rounded-full ${light ? "bg-white" : "bg-gradient-to-r from-brand-soft to-brand"}`} style={{ width: `${Math.max(4, Math.min(100, pct))}%` }} />}
      {pct < 100 && <span className={`flex-1 rounded-full ${light ? "bg-white/25" : "hatch"}`} />}
    </div>
  );
}

/** A grey tile with an icon in a white circle, a label, a number and a note (the hero's bottom row). */
export function Tile({ icon, label, value, note, href, tone }) {
  const body = (
    <>
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full bg-panel shadow-[var(--card-shadow)] ${tone === "red" && value ? "text-rose-500" : "text-brand"}`}>
        <Icon name={icon} size={15} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[11px] text-muted">{label}</span>
        <span className={`block text-lg font-medium leading-tight tabular-nums ${tone === "red" && value ? "text-rose-500" : ""}`}>{value}</span>
        {note && <span className="block truncate text-[11px] text-muted">{note}</span>}
      </span>
    </>
  );
  return href ? (
    <Link href={href} className="flex items-center gap-3 rounded-2xl bg-panel-2 p-3 transition hover:bg-panel-3">
      {body}
    </Link>
  ) : (
    <div className="flex items-center gap-3 rounded-2xl bg-panel-2 p-3">{body}</div>
  );
}

/** A small ring with a number (or %) in the middle. */
export function Ring({ pct, label, size = 44, light }) {
  const r = 15;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, pct || 0));
  return (
    <span className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90" style={{ width: size, height: size }}>
        <circle cx="18" cy="18" r={r} fill="none" stroke={light ? "rgb(255 255 255 / 0.2)" : "var(--color-panel-3)"} strokeWidth="3" />
        {p > 0 && <circle cx="18" cy="18" r={r} fill="none" stroke={light ? "#fff" : "var(--color-brand)"} strokeWidth="3" strokeLinecap="round" strokeDasharray={`${(c * p) / 100} ${c}`} />}
      </svg>
      <span className="text-[10.5px] font-medium tabular-nums">{label ?? `${Math.round(p)}%`}</span>
    </span>
  );
}

export const DARK = "rounded-[24px] bg-[#18181b] text-white shadow-[0_24px_50px_-28px_rgb(0_0_0/0.7)]";
