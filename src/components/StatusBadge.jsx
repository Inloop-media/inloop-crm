import { statusColor } from "@/lib/constants";

/** Status as a soft pill: a tinted fill, a dot in the status colour, readable text in both themes. */
export default function StatusBadge({ status, className = "" }) {
  const c = statusColor(status);
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 truncate rounded-full px-2.5 py-1 text-xs font-medium ${className}`}
      style={{ color: `color-mix(in oklab, ${c} 55%, var(--color-ink))`, background: `color-mix(in srgb, ${c} 14%, transparent)` }}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: c, boxShadow: `0 0 0 3px color-mix(in srgb, ${c} 22%, transparent)` }} />
      <span className="truncate">{status}</span>
    </span>
  );
}
