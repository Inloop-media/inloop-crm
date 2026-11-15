"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import Icon from "@/components/Icon";
import { STATUSES } from "@/lib/constants";
import { Avatar, BrandMark } from "@/components/ui";
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
  // A short board (a sales executive's) fits the width; the full board scrolls sideways
  const fit = stages.length <= 6;
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
      <div className="-mx-4 flex snap-x snap-mandatory scroll-px-4 items-start gap-4 overflow-x-auto px-4 pb-4 md:-mx-6 md:px-6">
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

          return (
            <section
              key={s.name}
              {...drop}
              className={`flex max-h-[calc(100svh-300px)] w-[82vw] shrink-0 snap-start flex-col rounded-[24px] transition ${fit ? "md:w-auto md:min-w-0 md:flex-1 md:shrink" : "sm:w-[290px]"} ${over === s.name ? "bg-brand/10 ring-2 ring-brand/40" : "bg-ink/[0.025] ring-1 ring-inset ring-ink/[0.04]"}`}
            >
              <header className="flex items-center gap-2 px-3 pb-2.5 pt-3">
                <span className="flex min-w-0 items-center gap-2 rounded-full bg-panel py-1 pl-2 pr-3 shadow-[var(--card-shadow)]">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color, boxShadow: `0 0 0 3px color-mix(in srgb, ${s.color} 22%, transparent)` }} />
                  <h2 className="truncate text-[13px] font-medium">{s.name}</h2>
                </span>
                <span className="ml-auto grid h-6 min-w-6 place-items-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums text-muted">{items.length}</span>
              </header>
              <div className="flex flex-col gap-2.5 overflow-y-auto p-2.5 pt-0">
                {!items.length && (
                  <div className={`grid place-items-center rounded-[18px] border border-dashed px-4 py-7 text-center text-xs transition ${over === s.name ? "border-brand/60 text-brand" : "border-line-strong text-faint"}`}>
                    {over === s.name ? "Drop to move here" : "No leads"}
                  </div>
                )}
                {items.map((l) => (
                  <Link
                    key={l.id}
                    href={`/leads/${l.id}`}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", l.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    className="card card-hover group block !rounded-[18px] p-3.5 active:cursor-grabbing"
                  >
                    <div className="flex items-start gap-3">
                      <BrandMark name={l.brand || fullName(l)} size={34} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[14px] font-medium leading-tight tracking-[-0.01em] group-hover:text-brand">{l.brand || fullName(l)}</div>
                        <div className="mt-0.5 truncate text-xs text-muted">{l.brand ? fullName(l) : l.email}</div>
                      </div>
                      <span className="code shrink-0">{l.code}</span>
                    </div>
                    {l.service && <div className="chip mt-3 max-w-full truncate !py-0.5 text-[11px]">{l.service}</div>}
                    <div className="mt-3 flex items-center gap-2 border-t border-dashed border-line-strong/70 pt-2.5 text-xs">
                      {l.assigned_to ? (
                        <>
                          <Avatar name={owners[l.assigned_to] || "?"} size={20} />
                          <span className="min-w-0 flex-1 truncate text-ink/75">{owners[l.assigned_to] || "—"}</span>
                        </>
                      ) : (
                        <span className="flex-1">
                          <span className="rounded-full bg-amber-400/15 px-2 py-0.5 font-medium text-amber-300">Unassigned</span>
                        </span>
                      )}
                      <span className="flex shrink-0 items-center gap-1 text-[11px] text-faint">
                        <Icon name="clock" size={11} />
                        {fmtDay(l.created_at)}
                      </span>
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
