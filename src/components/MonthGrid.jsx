// A Monday-first month grid. No hooks, so it works in server and client components alike.
//   month    "2026-11"
//   byDay    { "2026-11-04": [...] }
//   renderDay(dayKey, items, { today, inMonth }) → cell contents
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const todayKey = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

/** Every cell of the grid: leading days of the previous month, the month, trailing days. */
export function monthCells(month) {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const lead = (first.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const total = Math.ceil((lead + days) / 7) * 7;
  return Array.from({ length: total }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1, 1 + i - lead));
    return { key: d.toISOString().slice(0, 10), day: d.getUTCDate(), inMonth: i >= lead && i < lead + days };
  });
}

export default function MonthGrid({ month, byDay = {}, renderDay, onDropDay, onDragOverDay, className = "" }) {
  const today = todayKey();
  return (
    <div className={`overflow-hidden rounded-2xl border border-line ${className}`}>
      <div className="grid grid-cols-7 border-b border-line bg-panel-2/50">
        {WEEKDAYS.map((d) => (
          <div key={d} className="px-2 py-2 text-[10px] font-medium uppercase tracking-[0.08em] text-faint">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {monthCells(month).map((c, i) => (
          <div
            key={c.key}
            data-day={c.key}
            onDragOver={onDragOverDay ? (e) => onDragOverDay(e, c.key) : undefined}
            onDrop={onDropDay ? (e) => onDropDay(e, c.key) : undefined}
            className={`group/day relative min-h-[112px] border-line p-1.5 ${i % 7 ? "border-l" : ""} ${i >= 7 ? "border-t" : ""} ${c.inMonth ? "" : "bg-panel-2/30"}`}
          >
            <div className="mb-1 flex items-center justify-between px-1">
              <span className={`grid h-6 min-w-6 place-items-center rounded-full px-1 text-xs tabular-nums ${c.key === today ? "bg-brand font-semibold text-on-brand" : c.inMonth ? "text-muted" : "text-faint/60"}`}>{c.day}</span>
            </div>
            {renderDay(c.key, byDay[c.key] || [], { today: c.key === today, inMonth: c.inMonth })}
          </div>
        ))}
      </div>
    </div>
  );
}
