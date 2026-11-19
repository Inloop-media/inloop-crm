"use client";
// The agency's whole posting calendar in one month grid: every brand's planned posts on the day they go
// out, coloured by brand. Click a day to see everything going out that day; tick brands on or off.
import { useMemo, useState } from "react";
import Link from "next/link";
import Icon from "@/components/Icon";
import MonthGrid, { todayKey } from "@/components/MonthGrid";
import { itemState } from "@/components/ContentCalendar";
import { kindPlural, taskKindLabel } from "@/lib/constants";

const PALETTE = ["#ef3340", "#60a5fa", "#4ade80", "#fbbf24", "#a78bfa", "#22d3ee", "#f472b6", "#fb923c", "#a3e635", "#e879f9", "#38bdf8", "#facc15"];
const dayFmt = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const PLATFORM = { instagram: "Instagram", facebook: "Facebook", linkedin: "LinkedIn", youtube: "YouTube", x: "X", twitter: "X", website: "Website", other: "Other" };

/**
 *   month   "2026-11"
 *   brands  [{ id, name }]  — active brands
 *   items   calendar items of every brand this month (with task)
 */
export default function MasterCalendar({ month, brands, items }) {
  const color = useMemo(() => Object.fromEntries(brands.map((b, i) => [b.id, PALETTE[i % PALETTE.length]])), [brands]);
  const name = useMemo(() => Object.fromEntries(brands.map((b) => [b.id, b.name])), [brands]);
  const [off, setOff] = useState(() => new Set());
  const today = todayKey();
  const [day, setDay] = useState(() => (today.startsWith(month) ? today : null));

  const shown = items.filter((i) => !off.has(i.brand_id));
  const byDay = {};
  for (const i of shown) (byDay[i.publish_on] ||= []).push(i);
  const busiest = Object.entries(byDay).sort((a, b) => new Set(b[1].map((i) => i.brand_id)).size - new Set(a[1].map((i) => i.brand_id)).size)[0];
  const counts = Object.fromEntries(brands.map((b) => [b.id, items.filter((i) => i.brand_id === b.id).length]));
  const toggle = (id) =>
    setOff((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const selected = day ? byDay[day] || [] : [];
  const groups = [...new Set(selected.map((i) => i.brand_id))].map((id) => [id, selected.filter((i) => i.brand_id === id)]);

  return (
    <div className="flex flex-col gap-4">
      {/* Brand legend / filter */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs text-muted">
          {shown.length} posts · {new Set(shown.map((i) => i.brand_id)).size} brands
          {busiest ? ` · busiest day ${Number(busiest[0].slice(8))} (${new Set(busiest[1].map((i) => i.brand_id)).size} brands)` : ""}
        </span>
        {brands.map((b) => {
          const on = !off.has(b.id);
          return (
            <button
              key={b.id}
              onClick={() => toggle(b.id)}
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] transition ${on ? "border-line bg-panel text-ink" : "border-dashed border-line text-faint line-through"}`}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: on ? color[b.id] : "var(--color-faint)" }} />
              {b.name}
              <span className="text-[10px] tabular-nums text-muted">{counts[b.id]}</span>
            </button>
          );
        })}
        {off.size > 0 && (
          <button onClick={() => setOff(new Set())} className="text-xs text-muted underline-offset-2 hover:text-ink hover:underline">
            Show all
          </button>
        )}
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <MonthGrid
          month={month}
          byDay={byDay}
          className="bg-panel"
          renderDay={(key, list, { inMonth }) => {
            const brandsThatDay = new Set(list.map((i) => i.brand_id)).size;
            return (
              <button onClick={() => setDay(key)} className={`absolute inset-0 flex flex-col p-1.5 pt-8 text-left transition ${day === key ? "bg-brand/[0.07] ring-1 ring-inset ring-brand/50" : "hover:bg-panel-2/60"} ${inMonth ? "" : "opacity-50"}`}>
                {brandsThatDay > 1 && <span className="absolute right-1.5 top-1.5 rounded-full bg-panel-3 px-1.5 text-[10px] font-medium tabular-nums text-ink/80">{brandsThatDay} brands</span>}
                <span className="flex min-h-0 flex-col gap-0.5 overflow-hidden">
                  {list.slice(0, 4).map((i) => (
                    <span key={i.id} className={`flex items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-[10.5px] leading-tight ${i.status === "posted" ? "opacity-55" : ""}`} style={{ background: `color-mix(in srgb, ${color[i.brand_id]} 16%, transparent)` }}>
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color[i.brand_id] }} />
                      <span className="truncate">
                        <b className="font-semibold">{name[i.brand_id]}</b> · {i.title}
                      </span>
                    </span>
                  ))}
                  {list.length > 4 && <span className="px-1.5 text-[10px] font-medium text-muted">+{list.length - 4} more</span>}
                </span>
              </button>
            );
          }}
        />

        {/* The chosen day */}
        <aside className="card p-4 xl:sticky xl:top-4">
          {day ? (
            <>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-[15px] font-medium">{dayFmt.format(new Date(`${day}T00:00:00Z`))}</h3>
                  <p className="text-xs text-muted">{selected.length ? `${selected.length} post${selected.length > 1 ? "s" : ""} from ${groups.length} brand${groups.length > 1 ? "s" : ""}` : "Nothing planned this day"}</p>
                </div>
                {day === today && <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-semibold text-white">Today</span>}
              </div>
              <div className="mt-3 flex flex-col gap-3">
                {groups.map(([id, list]) => (
                  <section key={id} className="rounded-xl border border-line p-2.5">
                    <Link href={`/calendar?brand=${id}&month=${month}`} className="mb-1.5 flex items-center gap-2 text-[13px] font-medium hover:text-brand">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color[id] }} />
                      {name[id]}
                      <Icon name="arrow" size={11} className="ml-auto text-faint" />
                    </Link>
                    <ul className="flex flex-col gap-1.5">
                      {list.map((i) => {
                        const st = itemState(i);
                        return (
                          <li key={i.id} className="rounded-lg bg-panel-2 px-2.5 py-2">
                            <div className={`text-[13px] leading-snug ${i.status === "posted" ? "text-muted line-through" : ""}`}>{i.title}</div>
                            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted">
                              <span>{taskKindLabel(i.kind)}</span>
                              {i.platform && <span>· {String(i.platform).split(",").map((x) => PLATFORM[x] || x).join(", ")}</span>}
                              <span className="flex items-center gap-1">
                                · <span className="h-1.5 w-1.5 rounded-full" style={{ background: st.color }} />
                                {st.label}
                              </span>
                              {i.task?.assignee && <span>· {i.task.assignee.name.split(" ")[0]}</span>}
                            </div>
                            {(i.creative_brief || i.caption) && <p className="mt-1 line-clamp-2 text-[11px] text-ink/70">{i.creative_brief || i.caption}</p>}
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))}
                {!groups.length && <p className="py-6 text-center text-xs text-muted">Pick another day, or open a brand to plan posts.</p>}
              </div>
            </>
          ) : (
            <p className="py-10 text-center text-sm text-muted">Click a day to see every brand&apos;s posts on it.</p>
          )}
          {shown.length > 0 && (
            <div className="mt-4 border-t border-line pt-3">
              <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-faint">This month</div>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(shown.reduce((m, i) => ({ ...m, [i.kind]: (m[i.kind] || 0) + 1 }), {})).map(([k, n]) => (
                  <span key={k} className="rounded-full bg-panel-2 px-2 py-0.5 text-[11px] text-muted">
                    {kindPlural(k)} <b className="font-medium text-ink">{n}</b>
                  </span>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
