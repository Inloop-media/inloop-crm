import Link from "next/link";
import StatusBadge from "@/components/StatusBadge";
import { Avatar } from "@/components/ui";
import { fmtDateTime, fullName } from "@/lib/format";

export default function LeadList({ leads, owners }) {
  if (!leads.length) return <p className="card p-12 text-center text-sm text-muted">No leads match.</p>;
  return (
    <div className="card overflow-hidden">
      <table className="w-full text-left text-sm">
        <thead className="hidden border-b border-line bg-panel-2/60 text-[11px] uppercase tracking-[0.08em] text-muted md:table-header-group">
          <tr>
            <th className="px-4 py-3 font-medium">Lead</th>
            <th className="px-4 py-3 font-medium">Service</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Owner</th>
            <th className="px-4 py-3 font-medium">Registered</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((l) => (
            <tr key={l.id} className="relative block border-b border-line transition last:border-0 hover:bg-panel-2/70 md:table-row">
              <td className="block px-4 pt-3 md:table-cell md:py-3">
                <Link href={`/leads/${l.id}`} className="after:absolute after:inset-0">
                  <span className="rounded-md bg-panel-2 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-muted">{l.code}</span>
                  <span className="ml-2 font-semibold">{l.brand || fullName(l)}</span>
                  {l.brand && <span className="block text-xs text-muted">{fullName(l)}</span>}
                </Link>
              </td>
              <td className="block px-4 text-xs text-ink/70 md:table-cell md:py-3">{l.service || "—"}</td>
              <td className="block px-4 py-1.5 md:table-cell md:py-3">
                <StatusBadge status={l.status} />
              </td>
              <td className="inline-block px-4 pb-3 text-xs md:table-cell md:py-3">
                {l.assigned_to ? (
                  <span className="inline-flex items-center gap-2">
                    <Avatar name={owners[l.assigned_to] || "?"} size={22} />
                    {owners[l.assigned_to] || "—"}
                  </span>
                ) : (
                  <span className="text-amber-500">Unassigned</span>
                )}
              </td>
              <td className="inline-block pb-3 text-xs text-muted md:table-cell md:px-4 md:py-3">{fmtDateTime(l.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
