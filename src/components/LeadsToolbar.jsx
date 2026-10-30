"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Icon from "@/components/Icon";
import { STATUS_NAMES } from "@/lib/constants";

export default function LeadsToolbar({ members, showOwner, statuses = STATUS_NAMES }) {
  const router = useRouter();
  const params = useSearchParams();
  const view = params.get("view") === "list" ? "list" : "board";

  const go = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`/leads?${next.toString()}`);
  };

  const viewHref = (v) => {
    const next = new URLSearchParams(params);
    if (v === "board") next.delete("view");
    else next.set("view", v);
    return `/leads?${next.toString()}`;
  };

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <form
        className="relative min-w-[220px] flex-1 sm:max-w-md"
        onSubmit={(e) => {
          e.preventDefault();
          go("q", new FormData(e.currentTarget).get("q"));
        }}
      >
        <Icon name="search" size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-faint" />
        <input name="q" defaultValue={params.get("q") || ""} placeholder="Search name, brand, phone, IM-…" className="field rounded-full bg-panel py-3 pl-11 shadow-[var(--card-shadow)]" />
      </form>

      {showOwner && (
        <select value={params.get("owner") || ""} onChange={(e) => go("owner", e.target.value)} className="field w-auto rounded-full bg-panel py-3 shadow-[var(--card-shadow)]">
          <option value="">Everyone</option>
          <option value="unassigned">Unassigned</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      )}

      {view === "list" && (
        <select value={params.get("status") || ""} onChange={(e) => go("status", e.target.value)} className="field w-auto rounded-full bg-panel py-3 shadow-[var(--card-shadow)]">
          <option value="">All statuses</option>
          {statuses.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      )}

      <div className="seg ml-auto p-1.5">
        {["board", "list"].map((v) => (
          <Link key={v} href={viewHref(v)} data-on={view === v} className="seg-item flex items-center gap-1.5 capitalize">
            <Icon name={v === "board" ? "board" : "list"} size={14} />
            {v}
          </Link>
        ))}
      </div>
    </div>
  );
}
