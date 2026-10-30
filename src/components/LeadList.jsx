import Link from "next/link";
import Icon from "@/components/Icon";
import StatusBadge from "@/components/StatusBadge";
import { Avatar, Empty } from "@/components/ui";
import { fmtDateTime, fullName } from "@/lib/format";

export default function LeadList({ leads, owners }) {
  if (!leads.length)
    return (
      <div className="card">
        <Empty icon="search">No leads match these filters.</Empty>
      </div>
    );
  return (
    <div className="card overflow-hidden p-2">
      <table className="w-full border-separate border-spacing-0 text-left text-sm">
        <thead className="hidden text-xs text-muted md:table-header-group">
          <tr>
            <th className="px-4 pb-2 pt-3 font-medium">Lead</th>
            <th className="px-4 pb-2 pt-3 font-medium">Service</th>
            <th className="px-4 pb-2 pt-3 font-medium">Status</th>
            <th className="px-4 pb-2 pt-3 font-medium">Owner</th>
            <th className="px-4 pb-2 pt-3 font-medium">Registered</th>
            <th className="w-10" />
          </tr>
        </thead>
        <tbody>
          {leads.map((l) => (
            <tr key={l.id} className="group relative block rounded-2xl transition hover:bg-panel-2 md:table-row">
              <td className="block px-3 pt-3 md:table-cell md:rounded-l-2xl md:px-4 md:py-3.5">
                <Link href={`/leads/${l.id}`} className="flex items-center gap-3 after:absolute after:inset-0">
                  <Avatar name={l.brand || fullName(l)} size={38} />
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-medium">{l.brand || fullName(l)}</span>
                      <span className="code">{l.code}</span>
                    </span>
                    <span className="block truncate text-xs text-muted">{l.brand ? fullName(l) : l.email}</span>
                  </span>
                </Link>
              </td>
              <td className="block px-3 pl-[62px] pt-1 text-xs text-muted md:table-cell md:px-4 md:py-3.5">{l.service || "—"}</td>
              <td className="block px-3 pl-[62px] py-2 md:table-cell md:px-4 md:py-3.5">
                <StatusBadge status={l.status} />
              </td>
              <td className="inline-block px-3 pb-3 pl-[62px] text-xs md:table-cell md:px-4 md:py-3.5">
                {l.assigned_to ? (
                  <span className="inline-flex items-center gap-2">
                    <Avatar name={owners[l.assigned_to] || "?"} size={24} />
                    {owners[l.assigned_to] || "—"}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/15 px-2.5 py-1 font-medium text-amber-300">Unassigned</span>
                )}
              </td>
              <td className="inline-block pb-3 text-xs text-muted md:table-cell md:px-4 md:py-3.5">{fmtDateTime(l.created_at)}</td>
              <td className="hidden md:table-cell md:rounded-r-2xl md:pr-4">
                <Icon name="arrow" size={14} className="text-faint opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
