"use client";
// Kanban board for the heads: one column per stage, drag a card to move it. Only moves that make sense
// are allowed (the same rules as the buttons on the task page); sending work back asks for feedback.
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { Avatar } from "@/components/ui";
import { reviewTask, setTaskStatus } from "@/app/(crm)/tasks/actions";
import { KIND_COLOR, OPEN_TASK, TASK_STATUSES, taskKindLabel, byPriority } from "@/lib/constants";

const COLS = [
  { id: "todo", label: "To do", statuses: ["assigned"], color: TASK_STATUSES.assigned.color },
  { id: "doing", label: "Working on it", statuses: ["in_progress"], color: TASK_STATUSES.in_progress.color },
  { id: "revision", label: "Fix needed", statuses: ["revision"], color: TASK_STATUSES.revision.color },
  { id: "review", label: "To check", statuses: ["completed", "client_rejected"], color: TASK_STATUSES.completed.color, hint: "Finished work lands here" },
  { id: "ready", label: "Ready for client", statuses: ["ready"], color: TASK_STATUSES.ready.color, hint: "Approved — share it with the client" },
  { id: "client", label: "Shared with client", statuses: ["sent_to_client"], color: TASK_STATUSES.sent_to_client.color },
  { id: "done", label: "Approved", statuses: ["done"], color: TASK_STATUSES.done.color },
  { id: "hold", label: "On hold", statuses: ["on_hold"], color: TASK_STATUSES.on_hold.color, hint: "Open the task to resume it" },
];
const colOf = (status) => COLS.find((c) => c.statuses.includes(status))?.id;

/** What dropping a task with `from` status on column `to` does: { run, status, ask } or an error string. */
function move(from, to) {
  const maker = (s) => ({ run: (id) => setTaskStatus(id, s), status: s });
  const review = (a, status, ask) => ({ run: (id, feedback) => reviewTask(id, a, { feedback }), status, ask });
  const table = {
    todo: { in_progress: maker("assigned"), completed: maker("assigned") },
    doing: { assigned: maker("in_progress"), revision: maker("in_progress"), completed: maker("in_progress") },
    review: { assigned: maker("completed"), in_progress: maker("completed"), revision: maker("completed") },
    ready: { completed: review("ready", "ready") },
    revision: {
      completed: review("send_back", "revision", "What should they change?"),
      client_rejected: review("reassign", "revision", "Anything to add for the revision? (optional)"),
      ready: review("client_changes", "revision", "What does the client want changed?"),
      sent_to_client: review("client_changes", "revision", "What does the client want changed?"),
    },
    client: { completed: review("share_client", "sent_to_client"), ready: review("share_client", "sent_to_client") },
    done: { completed: review("approve", "done"), ready: review("client_ok", "done"), sent_to_client: review("client_ok", "done") },
  };
  return table[to]?.[from] || `Can't move “${TASK_STATUSES[from]?.label}” to ${COLS.find((c) => c.id === to)?.label} — open the task instead.`;
}

const msDay = 86400000;
const nowMs = () => Date.now();
function DueChip({ t }) {
  if (!t.due_at) return null;
  const ms = new Date(t.due_at).getTime() - nowMs();
  const open = OPEN_TASK.includes(t.status);
  const txt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }).format(new Date(t.due_at));
  const cls = open && ms < 0 ? "bg-rose-400/15 text-rose-400" : open && ms < msDay ? "bg-amber-400/15 text-amber-400" : "bg-panel-2 text-muted";
  return <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${cls}`}>{open && ms < 0 ? `Late · ${txt}` : txt}</span>;
}

export default function TaskBoard({ tasks: initial, showBrand = true }) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initial);
  const [synced, setSynced] = useState(initial);
  if (synced !== initial) {
    setSynced(initial);
    setTasks(initial);
  }
  const [over, setOver] = useState("");
  const [drag, setDrag] = useState("");
  const [ask, setAsk] = useState(null); // { task, m, text }
  const [error, setError] = useState("");
  const [, start] = useTransition();

  const apply = (t, m, feedback = "") => {
    setTasks((cur) => cur.map((x) => (x.id === t.id ? { ...x, status: m.status } : x)));
    start(async () => {
      const res = await m.run(t.id, feedback);
      if (!res.ok) {
        setError(res.error);
        setTasks(initial);
      }
      router.refresh();
    });
  };

  const drop = (col) => (e) => {
    e.preventDefault();
    setOver("");
    const t = tasks.find((x) => x.id === e.dataTransfer.getData("text/task"));
    if (!t || colOf(t.status) === col) return;
    setError("");
    const m = move(t.status, col);
    if (typeof m === "string") return setError(m);
    if (m.ask) return setAsk({ task: t, m, text: "" });
    apply(t, m);
  };

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p className="flex items-center gap-2 rounded-2xl bg-rose-400/10 px-4 py-2.5 text-xs text-rose-400">
          <Icon name="alert" size={13} /> {error}
        </p>
      )}
      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
        {COLS.map((c) => {
          // Work still with the team lead stays in "In progress" until they approve it
          const list = tasks.filter((t) => (t.with_lead ? c.id === "doing" : c.statuses.includes(t.status))).sort(c.id === "done" ? () => 0 : byPriority);
          const shown = c.id === "done" ? list.slice(0, 20) : list;
          const valid = drag && typeof move(tasks.find((x) => x.id === drag)?.status, c.id) !== "string";
          return (
            <section
              key={c.id}
              onDragOver={(e) => {
                e.preventDefault();
                if (over !== c.id) setOver(c.id);
              }}
              onDragLeave={() => over === c.id && setOver("")}
              onDrop={drop(c.id)}
              className={`flex w-[250px] shrink-0 snap-start xl:w-auto xl:min-w-0 xl:flex-1 flex-col rounded-[24px] bg-ink/[0.025] p-2 ring-1 ring-inset ring-ink/[0.04] transition ${over === c.id ? (valid ? "bg-brand/10 ring-1 ring-brand/50" : "ring-1 ring-rose-400/40") : ""} ${drag && !valid && colOf(tasks.find((x) => x.id === drag)?.status) !== c.id ? "opacity-50" : ""}`}
            >
              <header className="flex items-center gap-2 px-1 pb-2.5 pt-1">
                <span className="flex min-w-0 items-center gap-2 rounded-full bg-panel py-1 pl-2 pr-3 shadow-[var(--card-shadow)]">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: c.color, boxShadow: `0 0 0 3px color-mix(in srgb, ${c.color} 22%, transparent)` }} />
                  <span className="truncate text-[12.5px] font-medium">{c.label}</span>
                </span>
                <span className="ml-auto pr-1.5 text-[11px] font-semibold tabular-nums text-muted">{list.length}</span>
              </header>
              <div className="flex min-h-[120px] flex-col gap-2">
                {shown.map((t) => (
                  <Link
                    key={t.id}
                    href={`/tasks/${t.id}`}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/task", t.id);
                      e.dataTransfer.effectAllowed = "move";
                      setDrag(t.id);
                    }}
                    onDragEnd={() => {
                      setDrag("");
                      setOver("");
                    }}
                    className={`card card-hover group flex cursor-grab flex-col gap-2.5 !rounded-[18px] p-3.5 active:cursor-grabbing ${drag === t.id ? "opacity-40" : ""}`}
                  >
                    <div className="flex items-center gap-1.5 text-[10px] text-muted">
                      <span className="rounded-md px-1.5 py-px font-semibold uppercase tracking-wide" style={{ background: `color-mix(in srgb, ${KIND_COLOR[t.kind] || "#94a3b8"} 16%, transparent)`, color: `color-mix(in oklab, ${KIND_COLOR[t.kind] || "#94a3b8"} 60%, var(--color-ink))` }}>{taskKindLabel(t.kind)}</span>
                      {showBrand && t.brand && <span className="truncate">· {t.brand.name}</span>}
                      {t.status === "client_rejected" && <span className="ml-auto shrink-0 rounded-full bg-orange-400/15 px-1.5 font-medium text-orange-400">Client changes</span>}
                    </div>
                    <div className="text-[13px] font-medium leading-snug group-hover:text-brand">
                      {t.title}
                      {t.revision > 0 && <span className="ml-1.5 rounded-full bg-rose-400/15 px-1.5 text-[10px] font-semibold text-rose-400">R{t.revision}</span>}
                      {t.priority === "high" && c.id !== "done" && <span className="ml-1.5 rounded-full bg-red-500/15 px-1.5 text-[10px] font-semibold text-red-400">High</span>}
                    </div>
                    <div className="flex items-center justify-between gap-2 border-t border-dashed border-line-strong/70 pt-2.5">
                      <span className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted">
                        {t.assignee && <Avatar name={t.assignee.name} size={18} />}
                        <span className="truncate">{t.assignee?.name.split(" ")[0]}</span>
                      </span>
                      <DueChip t={t} />
                    </div>
                  </Link>
                ))}
                {!list.length && <div className="grid flex-1 place-items-center rounded-2xl border border-dashed border-line-strong px-3 py-6 text-center text-[11px] text-faint">{c.hint || "Nothing here"}</div>}
                {list.length > shown.length && <p className="px-2 text-center text-[11px] text-muted">+{list.length - shown.length} older</p>}
              </div>
            </section>
          );
        })}
      </div>

      {ask && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4">
          <button aria-label="Close" onClick={() => setAsk(null)} className="absolute inset-0 bg-black/45" />
          <form
            className="pop relative flex w-full max-w-md flex-col gap-3 p-5"
            onSubmit={(e) => {
              e.preventDefault();
              apply(ask.task, ask.m, ask.text);
              setAsk(null);
            }}
          >
            <h3 className="text-sm font-medium">{ask.task.title}</h3>
            <label className="text-xs text-muted">{ask.m.ask}</label>
            <textarea autoFocus className="field resize-y" rows={4} value={ask.text} onChange={(e) => setAsk({ ...ask, text: e.target.value })} required={!ask.m.ask.includes("optional")} />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setAsk(null)} className="btn-ghost btn-sm">
                Cancel
              </button>
              <button className="btn-primary btn-sm">Move</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
