import { statusColor } from "@/lib/constants";

export default function StatusBadge({ status, className = "" }) {
  const c = statusColor(status);
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 truncate rounded-full border px-2 py-0.5 text-xs font-medium ${className}`}
      style={{ color: c, background: `${c}1a`, borderColor: `${c}40` }}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: c }} />
      <span className="truncate">{status}</span>
    </span>
  );
}
