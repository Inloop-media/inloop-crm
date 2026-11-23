// A stacked bar of where a brand's posts stand (approved → shared → ready → in review → in progress →
// not assigned, the last one hatched), with an optional legend of the non-zero buckets.
import { BUCKETS } from "@/lib/workStatus";

export default function WorkBar({ c, legend = false, className = "h-2.5" }) {
  const total = c.total || 0;
  return (
    <div>
      <div className={`flex gap-[3px] overflow-hidden rounded-full ${total ? "" : "hatch"} ${className}`}>
        {BUCKETS.filter((b) => c[b.id]).map((b) => (
          <span key={b.id} title={`${c[b.id]} ${b.label.toLowerCase()}`} className={`h-full rounded-full ${b.color ? "" : "hatch border border-line-strong"}`} style={{ width: `${(c[b.id] / total) * 100}%`, ...(b.color ? { background: b.color } : {}) }} />
        ))}
      </div>
      {legend && (
        <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] text-muted">
          {BUCKETS.filter((b) => c[b.id]).map((b) => (
            <li key={b.id} className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${b.color ? "" : "hatch border border-line-strong"}`} style={b.color ? { background: b.color } : undefined} />
              <b className="font-medium tabular-nums text-ink">{c[b.id]}</b> {b.label.toLowerCase()}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
