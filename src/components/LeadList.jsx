import Link from "next/link";
import StatusBadge from "@/components/StatusBadge";
import { fmtDateTime, fullName } from "@/lib/format";

export default function LeadList({ leads, owners }) {
  if (!leads.length) return <p className="rounded-xl border border-line bg-panel p-8 text-center text-sm text-muted">No leads match.</p>;
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-panel">
      <table className="w-full text-left text-sm">
        <thead className="hidden border-b border-line text-xs uppercase tracking-wide text-muted md:table-header-group">
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
            <tr key={l.id} className="relative block border-b border-line last:border-0 hover:bg-panel-2 md:table-row">
              <td className="block px-4 pt-3 md:table-cell md:py-3">
                <Link href={`/leads/${l.id}`} className="after:absolute after:inset-0">
                  <span className="text-xs text-muted">{l.code}</span>
                  <span className="ml-2 font-medium">{l.brand || fullName(l)}</span>
                  {l.brand && <span className="block text-xs text-muted">{fullName(l)}</span>}
                </Link>
              </td>
              <td className="block px-4 text-xs text-white/70 md:table-cell md:py-3">{l.service || "—"}</td>
              <td className="block px-4 py-1.5 md:table-cell md:py-3">
                <StatusBadge status={l.status} />
              </td>
              <td className="inline-block px-4 pb-3 text-xs md:table-cell md:py-3">
                {l.assigned_to ? owners[l.assigned_to] || "—" : <span className="text-amber-500">Unassigned</span>}
              </td>
              <td className="inline-block pb-3 text-xs text-muted md:table-cell md:px-4 md:py-3">{fmtDateTime(l.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
