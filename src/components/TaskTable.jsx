// Tasks as one grouped table (server component): every group (To check, Late, In progress… or Do now,
// Coming up… for the person doing the work) is a fold-open section with a tinted header and a count, and
// the rows line up in columns — task · brand · person · given · due · status — so it's clear at a glance
// which task is where. Folds open and shut without JavaScript (<details>).
import Link from "next/link";
import Icon from "@/components/Icon";
import ShowMore from "@/components/ShowMore";
import { Avatar, tint } from "@/components/ui";
import { KIND_COLOR, OPEN_TASK, TASK_STATUSES, fromCalendar, taskKindLabel } from "@/lib/constants";

const IST = "Asia/Kolkata";
const dayKey = (d) => new Date(d).toLocaleDateString("en-CA", { timeZone: IST });
const short = new Intl.DateTimeFormat("en-IN", { timeZone: IST, day: "numeric", month: "short" });
const time = new Intl.DateTimeFormat("en-IN", { timeZone: IST, hour: "numeric", minute: "2-digit" });
const nowMs = () => Date.now();

/** Each group's colour and icon (the same for heads, leads and members). */
export const GROUP_LOOK = {
  check: { color: "#8b5cf6", icon: "check" },
  late: { color: "#f43f5e", icon: "clock" },
  progress: { color: "#f59e0b", icon: "tasks" },
  lead: { color: "#0ea5e9", icon: "team" },
  ready: { color: "#10b981", icon: "arrow" },
  hold: { color: "#94a3b8", icon: "clock" },
  client: { color: "#06b6d4", icon: "arrow" },
  done: { color: "#22c55e", icon: "check" },
  now: { color: "#f43f5e", icon: "sparkle" },
  next: { color: "#0ea5e9", icon: "calendar" },
  waiting: { color: "#8b5cf6", icon: "team" },
};

const KIND_ICON = { video: "video", reel: "video", website: "link", carousel: "board", story: "sparkle", design: "sparkle" };
const COLS = "md:grid-cols-[minmax(0,1fr)_120px_118px_92px_96px_148px]";
const COLS_ME = "md:grid-cols-[minmax(0,1fr)_130px_92px_96px_160px]";

function given(t) {
  if (!t.created_at) return "—";
  const k = dayKey(t.created_at);
  if (k === dayKey(nowMs())) return "Today";
  if (k === dayKey(nowMs() - 864e5)) return "Yesterday";
  return short.format(new Date(t.created_at));
}

function due(t) {
  if (t.status === "done") return { text: t.done_at ? `Done ${short.format(new Date(t.done_at))}` : "Done", tone: "text-muted" };
  if (!t.due_at) return { text: "No date", tone: "text-faint" };
  const at = new Date(t.due_at);
  const ms = at.getTime() - nowMs();
  if (OPEN_TASK.includes(t.status) && ms < 0) {
    const d = Math.floor(-ms / 864e5);
    return { text: d ? `${d}d late` : "Late", tone: "text-rose-500 font-medium" };
  }
  const k = dayKey(at);
  const hasTime = at.toLocaleTimeString("en-GB", { timeZone: IST, hour: "2-digit", minute: "2-digit" }) !== "23:59";
  if (k === dayKey(nowMs())) return { text: hasTime ? `Today ${time.format(at)}` : "Today", tone: "text-amber-600 dark:text-amber-400 font-medium" };
  if (k === dayKey(nowMs() + 864e5)) return { text: "Tomorrow", tone: "text-ink/80" };
  return { text: short.format(at), tone: "text-muted" };
}

function statusLabel(t) {
  if (t.with_lead) return "With team lead";
  if (t.status === "completed") return "To check";
  if (t.status === "client_rejected") return "Client changes";
  return TASK_STATUSES[t.status]?.label || t.status;
}

export function StatusPill({ t }) {
  const color = t.with_lead ? "#0ea5e9" : TASK_STATUSES[t.status]?.color || "#94a3b8";
  return (
    <span
      className="inline-flex max-w-full items-center gap-1.5 rounded-full px-2 py-0.5 text-[11.5px] font-medium"
      style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, color: `color-mix(in oklab, ${color} 75%, var(--color-ink))` }}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />
      <span className="truncate">{statusLabel(t)}</span>
    </span>
  );
}

/** One task as a table row. mine: the person doing it (no person column; `action` = Start / Upload). */
export function TaskRow({ t, mine = false, action = null, showBrand = true }) {
  const c = KIND_COLOR[t.kind] || "#64748b";
  const d = due(t);
  const done = t.status === "done";
  const fresh = t.status === "assigned" && t.created_at && dayKey(t.created_at) === dayKey(nowMs());
  const note = t.status === "revision" && t.feedback ? t.feedback : t.status === "on_hold" ? `On hold${t.hold_reason ? ` — ${t.hold_reason}` : ""}` : "";
  return (
    <li
      className={`group relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 border-t border-line px-4 py-2.5 transition first:border-t-0 hover:bg-panel-2/60 ${mine ? COLS_ME : COLS}`}
    >
      <Link href={`/tasks/${t.id}`} className="absolute inset-0 z-0" aria-label={t.title} />
      {/* Task */}
      <span className="flex min-w-0 items-center gap-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: `color-mix(in srgb, ${c} 13%, transparent)`, color: c }}>
          <Icon name={done ? "check" : KIND_ICON[t.kind] || "file"} size={14} />
        </span>
        <span className="min-w-0">
          <span className={`flex items-center gap-1.5 text-[13.5px] font-medium group-hover:text-brand ${done ? "text-muted" : ""}`}>
            {t.priority === "high" && !done && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" title="High priority" />}
            <span className="truncate">{t.title}</span>
            {fresh && <span className="shrink-0 rounded-full bg-brand px-1.5 py-px text-[10px] font-semibold text-white">New</span>}
            {t.revision > 0 && <span className="shrink-0 text-[11px] font-normal text-muted">v{t.revision + 1}</span>}
          </span>
          <span className="flex items-center gap-1.5 truncate text-[11.5px] text-muted">
            {fromCalendar(t) && (
              <span className="inline-flex shrink-0 items-center gap-0.5 rounded bg-sky-500/10 px-1 text-[10.5px] font-medium text-sky-600 dark:text-sky-400">
                <Icon name="calendar" size={10} /> Calendar
              </span>
            )}
            <span className="truncate">
              {taskKindLabel(t.kind)}
              {/* On phones the columns fold into this line */}
              <span className="md:hidden">{[showBrand && t.brand?.name, !mine && t.assignee?.name?.split(" ")[0], `given ${given(t).toLowerCase()}`].filter(Boolean).map((x) => ` · ${x}`)}</span>
            </span>
          </span>
          {note && (
            <span
              className={`mt-1 line-clamp-1 block rounded-md px-2 py-0.5 text-[11px] ${t.status === "revision" ? "bg-rose-400/10 text-rose-500" : "bg-amber-500/10 text-amber-600 dark:text-amber-400"}`}
            >
              {t.status === "revision" ? `“${note}”` : note}
            </span>
          )}
        </span>
      </span>
      {/* Brand */}
      <span className="hidden min-w-0 items-center gap-1.5 text-[12.5px] md:flex">
        {t.brand?.name ? (
          <>
            <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: tint(t.brand.name) }} />
            <span className="truncate">{t.brand.name}</span>
          </>
        ) : (
          <span className="text-faint">—</span>
        )}
      </span>
      {/* Person */}
      {!mine && (
        <span className="hidden min-w-0 items-center gap-2 text-[12.5px] md:flex">
          {t.assignee?.name ? (
            <>
              <Avatar name={t.assignee.name} size={22} />
              <span className="truncate">{t.assignee.name.split(" ")[0]}</span>
            </>
          ) : (
            <span className="text-faint">—</span>
          )}
        </span>
      )}
      {/* Given */}
      <span className="hidden text-[12.5px] text-muted md:block">{given(t)}</span>
      {/* Due */}
      <span className={`text-right text-[12.5px] md:text-left ${d.tone}`}>{d.text}</span>
      {/* Status / next step */}
      <span className="relative z-[1] col-span-2 flex justify-start pl-11 md:col-span-1 md:justify-end md:pl-0">{action || (!mine && <StatusPill t={t} />)}</span>
    </li>
  );
}

function Head({ mine }) {
  return (
    <div className={`hidden gap-x-4 border-b border-line px-4 py-2 text-[11px] font-medium uppercase tracking-[0.06em] text-faint md:grid ${mine ? COLS_ME : COLS}`}>
      <span>Task</span>
      <span>Brand</span>
      {!mine && <span>Person</span>}
      <span>Given</span>
      <span>Due</span>
      <span className="text-right">{mine ? "Next step" : "Status"}</span>
    </div>
  );
}

/**
 * groups  [{ key, title, list, empty }]
 * open    which groups start open (the rest fold shut)
 * row     (task, groupKey) => a custom row (e.g. the To check row with Approve / Send back)
 * action  (task) => the right-hand cell instead of the status (members: Start / Upload & submit)
 */
export default function TaskTable({ groups, open = [], mine = false, row = null, action = null, showBrand = true, limit = 8 }) {
  return (
    <div className="flex flex-col gap-3">
      {groups.map((g) => {
        const look = GROUP_LOOK[g.key] || { color: "#94a3b8", icon: "tasks" };
        const n = g.list.length;
        return (
          <details key={g.key} open={n > 0 && open.includes(g.key)} className="card group/g overflow-hidden p-0">
            <summary
              className="flex cursor-pointer list-none items-center gap-2.5 px-4 py-3 [&::-webkit-details-marker]:hidden"
              style={{ background: n ? `color-mix(in srgb, ${look.color} 7%, transparent)` : undefined }}
            >
              <Icon name="chevron" size={14} className="-rotate-90 text-muted transition group-open/g:rotate-0" />
              <span className="grid h-6 w-6 place-items-center rounded-md" style={{ background: `color-mix(in srgb, ${look.color} 18%, transparent)`, color: look.color }}>
                <Icon name={look.icon} size={12} />
              </span>
              <span className={`text-[14px] font-medium ${n ? "" : "text-muted"}`}>{g.title}</span>
              <span
                className="grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums"
                style={n ? { background: look.color, color: "#fff" } : { background: "var(--color-panel-2)", color: "var(--color-faint)" }}
              >
                {n}
              </span>
              {g.sub && <span className="ml-auto hidden truncate text-[12px] text-muted sm:block">{g.sub}</span>}
            </summary>
            {n === 0 ? (
              <p className="border-t border-line px-4 py-4 text-[13px] text-muted">{g.empty || "Nothing here."}</p>
            ) : row && row(g.list[0], g.key) ? (
              <ul className="border-t border-line px-4">
                <ShowMore limit={limit}>{g.list.map((t) => row(t, g.key))}</ShowMore>
              </ul>
            ) : (
              <div className="border-t border-line">
                <Head mine={mine} />
                <ul>
                  <ShowMore limit={limit}>
                    {g.list.map((t) => (
                      <TaskRow key={t.id} t={t} mine={mine} showBrand={showBrand} action={action ? action(t) : null} />
                    ))}
                  </ShowMore>
                </ul>
              </div>
            )}
          </details>
        );
      })}
    </div>
  );
}
