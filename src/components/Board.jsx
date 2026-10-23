"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { STATUSES } from "@/lib/constants";
import { fmtDay, fullName } from "@/lib/format";
import { updateLead } from "@/app/(crm)/actions";

/** Pipeline board: one column per status, drag a card to change its status. */
export default function Board({ leads: initial, owners }) {
  const [leads, setLeads] = useState(initial);
  const [over, setOver] = useState(null);
  const [error, setError] = useState("");
  const [, startTransition] = useTransition();

  // Keep in sync when the server sends fresh data (search, filters, other people's edits)
  const [prevInitial, setPrevInitial] = useState(initial);
  if (initial !== prevInitial) {
    setPrevInitial(initial);
    setLeads(initial);
  }

  const move = (id, status) => {
    const lead = leads.find((l) => l.id === id);
    if (!lead || lead.status === status) return;
    const before = leads;
    setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, status } : l)));
    setError("");
    startTransition(async () => {
      const res = await updateLead(id, { status });
      if (!res.ok) {
        setLeads(before);
        setError(res.error || "Couldn't move that lead.");
      }
    });
  };

  return (
    <div>
      {error && <p className="mb-3 text-sm text-red-400">{error}</p>}
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-4 md:-mx-6 md:px-6">
        {STATUSES.map((s) => {
          const items = leads.filter((l) => l.status === s.name);
          return (
            <section
              key={s.name}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(s.name);
              }}
              onDragLeave={() => setOver((o) => (o === s.name ? null : o))}
              onDrop={(e) => {
                e.preventDefault();
                setOver(null);
                move(e.dataTransfer.getData("text/plain"), s.name);
              }}
              className={`flex w-[272px] shrink-0 flex-col rounded-xl border bg-panel transition ${over === s.name ? "border-brand/60" : "border-line"}`}
            >
              <header className="flex items-center gap-2 border-b border-line px-3 py-2.5">
                <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                <h2 className="truncate text-sm font-medium">{s.name}</h2>
                <span className="ml-auto text-xs text-muted">{items.length}</span>
              </header>
              <div className="flex min-h-[120px] flex-col gap-2 p-2">
                {items.map((l) => (
                  <Link
                    key={l.id}
                    href={`/leads/${l.id}`}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", l.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    className="block rounded-lg border border-line bg-panel-2 p-3 transition hover:border-white/20"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs text-muted">
                      <span>{l.code}</span>
                      <span>{fmtDay(l.created_at)}</span>
                    </div>
                    <div className="mt-1.5 truncate text-sm font-medium">{l.brand || fullName(l)}</div>
                    <div className="truncate text-xs text-muted">{l.brand ? fullName(l) : l.email}</div>
                    {l.service && <div className="mt-2 truncate text-xs text-white/70">{l.service}</div>}
                    <div className="mt-2 truncate text-xs" style={{ color: l.assigned_to ? "#c7c7d1" : "#f59e0b" }}>
                      {l.assigned_to ? owners[l.assigned_to] || "—" : "Unassigned"}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
