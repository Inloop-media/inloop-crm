"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { STATUSES } from "@/lib/constants";
import { Avatar } from "@/components/ui";
import { fmtDay, fullName } from "@/lib/format";
import { updateLead } from "@/app/(crm)/actions";

/**
 * Pipeline board: one column per status, drag a card to change its status.
 * `columns` limits the stages shown (sales executives stop at the proposal meeting); leads further
 * along sit in the last column.
 */
export default function Board({ leads: initial, owners, allowed, columns }) {
  const stages = columns ? STATUSES.filter((s) => columns.includes(s.name)) : STATUSES;
  const last = stages.at(-1)?.name;
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
    if (!allowed.includes(status) || !allowed.includes(lead.status)) {
      setError("Executives can move leads up to Discovery Call — the admin takes it from there.");
      return;
    }
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
      {error && <p className="mb-3 text-sm text-rose-400">{error}</p>}
      <div className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-4 md:-mx-8 md:snap-none md:gap-2.5 md:px-8">
        {stages.map((s) => {
          const items = leads.filter((l) => l.status === s.name || (columns && s.name === last && !columns.includes(l.status)));
          const drop = {
            onDragOver: (e) => {
              e.preventDefault();
              setOver(s.name);
            },
            onDragLeave: () => setOver((o) => (o === s.name ? null : o)),
            onDrop: (e) => {
              e.preventDefault();
              setOver(null);
              move(e.dataTransfer.getData("text/plain"), s.name);
            },
          };

          // Empty stages fold into a slim rail so the board fits without scrolling sideways
          if (!items.length) {
            return (
              <section
                key={s.name}
                {...drop}
                title={`${s.name} — drop a lead here`}
                className={`hidden h-[calc(100svh-290px)] min-h-[260px] w-11 shrink-0 flex-col items-center gap-3 rounded-[22px] py-4 transition md:flex ${
                  over === s.name ? "w-[200px] bg-brand/10 ring-2 ring-brand/40" : "bg-panel/40 ring-1 ring-inset ring-line"
                }`}
              >
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} />
                <span className="text-[11px] tabular-nums text-faint">0</span>
                <span className="whitespace-nowrap text-xs text-muted [writing-mode:vertical-rl]">{s.name}</span>
              </section>
            );
          }

          return (
            <section
              key={s.name}
              {...drop}
              className={`flex max-h-[calc(100svh-330px)] w-[84vw] shrink-0 snap-start flex-col rounded-[24px] transition md:max-h-[calc(100svh-290px)] md:w-auto md:min-w-[220px] md:max-w-[300px] md:flex-1 md:shrink md:basis-[260px] ${over === s.name ? "bg-brand/10 ring-2 ring-brand/40" : "bg-panel/50 ring-1 ring-inset ring-line/70"}`}
            >
              <header className="flex items-center gap-2 px-4 pb-3 pt-4">
                <span className="h-2 w-2 rounded-full" style={{ background: s.color, boxShadow: `0 0 0 3px color-mix(in srgb, ${s.color} 22%, transparent)` }} />
                <h2 className="truncate text-sm font-medium">{s.name}</h2>
                <span className="ml-auto rounded-full bg-panel px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted shadow-[var(--card-shadow)]">{items.length}</span>
              </header>
              <div className="flex flex-col gap-2.5 overflow-y-auto p-2.5 pt-0">
                {items.map((l) => (
                  <Link
                    key={l.id}
                    href={`/leads/${l.id}`}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", l.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    className="card card-hover block !rounded-[20px] p-4 active:cursor-grabbing"
                  >
                    <div className="flex items-center justify-between gap-2 text-[11px] text-faint">
                      <span className="code">{l.code}</span>
                      <span>{fmtDay(l.created_at)}</span>
                    </div>
                    <div className="mt-2.5 truncate text-[15px] font-medium tracking-[-0.01em]">{l.brand || fullName(l)}</div>
                    <div className="truncate text-xs text-muted">{l.brand ? fullName(l) : l.email}</div>
                    {l.service && <div className="chip mt-3 max-w-full truncate text-[11px]">{l.service}</div>}
                    <div className="mt-3.5 flex items-center gap-2 border-t border-line pt-3 text-xs">
                      {l.assigned_to ? (
                        <>
                          <Avatar name={owners[l.assigned_to] || "?"} size={20} />
                          <span className="truncate text-ink/75">{owners[l.assigned_to] || "—"}</span>
                        </>
                      ) : (
                        <span className="rounded-full bg-amber-400/15 px-2 py-0.5 font-medium text-amber-300">Unassigned</span>
                      )}
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
