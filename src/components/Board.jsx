"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { STATUSES } from "@/lib/constants";
import { Avatar } from "@/components/ui";
import { fmtDay, fullName } from "@/lib/format";
import { updateLead } from "@/app/(crm)/actions";

/** Pipeline board: one column per status, drag a card to change its status. */
export default function Board({ leads: initial, owners, allowed }) {
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
        {STATUSES.map((s) => {
          const items = leads.filter((l) => l.status === s.name);
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
                className={`hidden h-[calc(100svh-250px)] min-h-[260px] w-10 shrink-0 flex-col items-center gap-3 rounded-2xl border border-dashed py-3 transition md:flex ${
                  over === s.name ? "w-[200px] border-brand/60 bg-brand/[0.06]" : "border-line bg-panel/40"
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
              className={`flex max-h-[calc(100svh-310px)] w-[84vw] shrink-0 snap-start flex-col rounded-2xl border bg-panel-2/40 transition md:max-h-[calc(100svh-250px)] md:w-auto md:min-w-[210px] md:max-w-[300px] md:flex-1 md:shrink md:basis-[250px] ${over === s.name ? "border-brand/60 bg-brand/[0.05]" : "border-line"}`}
            >
              <header className="flex items-center gap-2 px-3.5 pb-2.5 pt-3.5">
                <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                <h2 className="truncate text-[13px] font-semibold">{s.name}</h2>
                <span className="ml-auto rounded-full border border-line bg-panel px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted">{items.length}</span>
              </header>
              <div className="flex flex-col gap-2 overflow-y-auto p-2 pt-1">
                {items.map((l) => (
                  <Link
                    key={l.id}
                    href={`/leads/${l.id}`}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", l.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    className="card card-hover block rounded-xl p-3.5 active:cursor-grabbing"
                  >
                    <div className="flex items-center justify-between gap-2 text-[11px] text-faint">
                      <span className="rounded-md bg-panel-2 px-1.5 py-0.5 font-medium tabular-nums text-muted">{l.code}</span>
                      <span>{fmtDay(l.created_at)}</span>
                    </div>
                    <div className="mt-2 truncate text-[15px] font-semibold tracking-[-0.01em]">{l.brand || fullName(l)}</div>
                    <div className="truncate text-xs text-muted">{l.brand ? fullName(l) : l.email}</div>
                    {l.service && <div className="mt-2.5 inline-block max-w-full truncate rounded-md border border-line px-1.5 py-0.5 text-[11px] text-ink/70">{l.service}</div>}
                    <div className="mt-3 flex items-center gap-2 border-t border-line pt-2.5 text-xs">
                      {l.assigned_to ? (
                        <>
                          <Avatar name={owners[l.assigned_to] || "?"} size={20} />
                          <span className="truncate text-ink/75">{owners[l.assigned_to] || "—"}</span>
                        </>
                      ) : (
                        <span className="text-amber-400">Unassigned</span>
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
