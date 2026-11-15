// Building blocks shared by the list pages, matching the reference layout (server-safe, no hooks):
//   PageTop     — big title + one-line summary on the left, pills / actions on the right
//   FilterPills — "All 10 · Posts 4 · Reels 3" with the active one in black
//   Section     — a white card with a title and a count badge
//   TaskLine    — one task row: ring, kind icon, title + brand, status pill, due pill, avatar, open
import Link from "next/link";
import Icon from "@/components/Icon";
import { Avatar } from "@/components/ui";
import { KIND_COLOR, OPEN_TASK, TASK_STATUSES, taskKindLabel } from "@/lib/constants";

const IST = "Asia/Kolkata";
const dayKey = (d) => new Date(d).toLocaleDateString("en-CA", { timeZone: IST });
const short = new Intl.DateTimeFormat("en-IN", { timeZone: IST, day: "numeric", month: "short" });
const nowMs = () => Date.now();

export function PageTop({ title, sub, right }) {
  return (
    <header className="rise mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        <h1 className="page-title">{title}</h1>
        {sub && <p className="mt-2 text-[13px] text-muted">{sub}</p>}
      </div>
      {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
    </header>
  );
}

/** items: [{ label, count, href, on }] */
export function FilterPills({ items, className = "" }) {
  return (
    <nav className={`inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-full bg-panel p-1 shadow-[var(--card-shadow)] ${className}`}>
      {items.map((it) => (
        <Link
          key={it.href}
          href={it.href}
          scroll={false}
          className={`flex shrink-0 items-center gap-1.5 rounded-full py-1.5 pl-3 text-[12px] font-medium transition ${it.count === undefined ? "pr-3" : "pr-1.5"} ${it.on ? "bg-solid text-on-solid" : "text-muted hover:text-ink"}`}
        >
          {it.label}
          {it.count !== undefined && (
            <span className={`grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[10px] font-semibold tabular-nums ${it.on ? "bg-white/20" : "bg-panel-2 text-muted"}`}>{it.count}</span>
          )}
        </Link>
      ))}
    </nav>
  );
}

export function Section({ title, count, tone = "#e11d2e", action, children, empty, className = "" }) {
  return (
    <section className={`card min-w-0 p-4 sm:p-5 ${className}`}>
      <header className="mb-2 flex items-center gap-2">
        <h2 className="text-[17px] font-normal tracking-[-0.01em]">{title}</h2>
        {count !== undefined && (
          <span className="grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums" style={{ background: `color-mix(in srgb, ${tone} 14%, transparent)`, color: tone }}>
            {count}
          </span>
        )}
        {action && <span className="ml-auto">{action}</span>}
      </header>
      {count === 0 && empty ? <p className="py-6 text-center text-[13px] text-muted">{empty}</p> : <ul className="flex flex-col">{children}</ul>}
    </section>
  );
}

const KIND_ICON = { video: "video", reel: "video", website: "link", carousel: "board", story: "sparkle", design: "sparkle" };

function duePill(t) {
  if (!t.due_at) return { text: "No date", cls: "bg-panel-2 text-faint" };
  const ms = new Date(t.due_at).getTime() - nowMs();
  const open = OPEN_TASK.includes(t.status);
  if (open && ms < 0) {
    const d = Math.floor(-ms / 864e5);
    return { text: d ? `${d}d overdue` : "Overdue", cls: "bg-rose-400/12 text-rose-400" };
  }
  const k = dayKey(t.due_at);
  if (k === dayKey(nowMs())) return { text: "Today", cls: "bg-amber-400/15 text-amber-400" };
  if (k === dayKey(nowMs() + 864e5)) return { text: "Tomorrow", cls: "bg-panel-2 text-ink/70" };
  return { text: short.format(new Date(t.due_at)), cls: "bg-panel-2 text-ink/70" };
}

/** One task, like a row in the reference "Tasks" page. `action` replaces the open button on the right. */
export function TaskLine({ t, showBrand = true, action, note }) {
  const s = TASK_STATUSES[t.status] || { label: t.status, color: "#94a3b8" };
  const c = KIND_COLOR[t.kind] || "#64748b";
  const due = duePill(t);
  const done = t.status === "done";
  return (
    <li className="group relative flex items-center gap-3 border-b border-line py-2.5 last:border-0">
      <Link href={`/tasks/${t.id}`} className="absolute inset-0 z-0" aria-label={t.title} />
      <span className={`grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border-[1.5px] ${done ? "border-brand bg-brand text-white" : "border-line-strong"}`}>
        {done && <Icon name="check" size={10} />}
      </span>
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full" style={{ background: `color-mix(in srgb, ${c} 13%, transparent)`, color: c }}>
        <Icon name={KIND_ICON[t.kind] || "file"} size={14} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-[13px] font-medium group-hover:text-brand ${done ? "text-muted line-through" : ""}`}>
          {t.title}
          {t.revision > 0 && <span className="ml-1.5 rounded-full bg-rose-400/15 px-1.5 text-[10px] font-semibold text-rose-400 no-underline">R{t.revision}</span>}
        </span>
        <span className="block truncate text-[11px] text-muted">
          {taskKindLabel(t.kind)}
          {showBrand && t.brand ? ` · ${t.brand.name}` : ""}
        </span>
        {note && <span className="mt-1 line-clamp-2 block rounded-lg bg-rose-400/10 px-2 py-1 text-[11px] text-rose-400">“{note}”</span>}
      </span>
      <span
        className="hidden shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-medium sm:inline"
        style={{ background: `color-mix(in srgb, ${s.color} 15%, transparent)`, color: `color-mix(in oklab, ${s.color} 62%, var(--color-ink))` }}
      >
        {t.status === "completed" ? "To check" : t.status === "client_rejected" ? "Client changes" : s.label}
      </span>
      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-medium ${due.cls}`}>{due.text}</span>
      {t.assignee && (
        <span className="hidden shrink-0 sm:block" title={t.assignee.name}>
          <Avatar name={t.assignee.name} size={24} />
        </span>
      )}
      <span className="relative z-[1] shrink-0">
        {action || (
          <Link href={`/tasks/${t.id}`} aria-label="Open" className="grid h-7 w-7 place-items-center rounded-full bg-panel-2 text-muted transition hover:bg-panel-3 hover:text-ink">
            <Icon name="arrow" size={12} className="-rotate-45" />
          </Link>
        )}
      </span>
    </li>
  );
}
