// Task list pieces (server-safe, no hooks)
import Link from "next/link";
import Icon from "@/components/Icon";
import { Avatar, Empty } from "@/components/ui";
import { OPEN_TASK, TASK_STATUSES, taskKindLabel } from "@/lib/constants";
import { fmtMeeting } from "@/lib/format";

export function TaskStatusPill({ status, className = "" }) {
  const s = TASK_STATUSES[status] || { label: status, color: "#9ca3af" };
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${className}`}
      style={{ background: `color-mix(in srgb, ${s.color} 16%, transparent)`, color: `color-mix(in oklab, ${s.color} 70%, var(--color-ink))` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />
      {s.label}
    </span>
  );
}

const msUntil = (d) => new Date(d).getTime() - Date.now();

/** "Due in 5h", "Overdue 2d", "Due 20 Nov" */
export function DueLabel({ due, status }) {
  if (!due) return <span className="text-faint">No due date</span>;
  const ms = msUntil(due);
  const open = OPEN_TASK.includes(status);
  if (open && ms < 0) {
    const d = Math.floor(-ms / 86400000);
    return <span className="font-medium text-rose-400">Overdue{d ? ` ${d}d` : ""}</span>;
  }
  if (open && ms < 86400000) return <span className="font-medium text-amber-400">Due in {Math.max(1, Math.round(ms / 3600000))}h</span>;
  return <span>Due {fmtMeeting(due)}</span>;
}

export function TaskRow({ t, showBrand = true, showAssignee = true }) {
  return (
    <Link href={`/tasks/${t.id}`} className="group flex items-center gap-3 rounded-2xl px-3 py-3 transition hover:bg-panel-2 sm:px-4">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-panel-2 text-[10px] font-semibold uppercase tracking-wide text-muted group-hover:bg-panel">
        {taskKindLabel(t.kind).slice(0, 4)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{t.title}</span>
          {t.revision > 0 && <span className="shrink-0 rounded-full bg-rose-400/15 px-1.5 py-0.5 text-[10px] font-semibold text-rose-400">R{t.revision}</span>}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
          {showBrand && t.brand && <span className="truncate">{t.brand.name}</span>}
          {showBrand && t.brand && <span className="h-1 w-1 rounded-full bg-faint" />}
          <DueLabel due={t.due_at} status={t.status} />
        </div>
      </div>
      {showAssignee && t.assignee && (
        <span className="hidden items-center gap-1.5 text-xs text-muted sm:flex">
          <Avatar name={t.assignee.name} size={24} />
          <span className="max-w-[7rem] truncate">{t.assignee.name}</span>
        </span>
      )}
      <TaskStatusPill status={t.status} className="hidden sm:inline-flex" />
      <Icon name="chevron" size={14} className="-rotate-90 text-faint" />
    </Link>
  );
}

export function TaskList({ tasks, empty = "Nothing here.", ...rest }) {
  if (!tasks.length) return <Empty icon="tasks">{empty}</Empty>;
  return (
    <div className="-mx-3 flex flex-col divide-y divide-line sm:-mx-4">
      {tasks.map((t) => (
        <TaskRow key={t.id} t={t} {...rest} />
      ))}
    </div>
  );
}

/** Thin progress bar: approved / total. */
export function Progress({ done, total }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs text-muted">
        <span>
          <span className="text-base font-medium text-ink">{done}</span> / {total} approved
        </span>
        <span className="tabular-nums">{pct}%</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-panel-2">
        <div className="bar-fill h-full rounded-full" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
