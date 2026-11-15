// The employee's day: what to fix, what's late, what's due today / this week / later, and what's
// waiting on someone else. One clear next step on every row.
import Link from "next/link";
import Icon from "@/components/Icon";
import { Empty, StatCard } from "@/components/ui";
import StartTask from "@/components/StartTask";
import { OPEN_TASK, TASK_STATUSES, taskKindLabel } from "@/lib/constants";

const now = () => Date.now();
const IST = "Asia/Kolkata";
const dayKey = (d) => new Date(d).toLocaleDateString("en-CA", { timeZone: IST });
const short = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: IST });
const KIND_COLOR = { post: "#60a5fa", carousel: "#a78bfa", story: "#f472b6", reel: "#fbbf24", video: "#22d3ee", design: "#4ade80", website: "#94a3b8", other: "#94a3b8" };

function when(t) {
  if (!t.due_at) return { text: "No date", cls: "bg-panel-2 text-faint" };
  const ms = new Date(t.due_at).getTime() - now();
  if (OPEN_TASK.includes(t.status) && ms < 0) {
    const d = Math.floor(-ms / 86400000);
    return { text: d ? `${d} day${d > 1 ? "s" : ""} late` : "Late today", cls: "bg-rose-400/12 text-rose-400" };
  }
  if (OPEN_TASK.includes(t.status) && ms < 86400000) return { text: `Due in ${Math.max(1, Math.round(ms / 3600000))}h`, cls: "bg-amber-400/15 text-amber-400" };
  return { text: short.format(new Date(t.due_at)), cls: "bg-panel-2 text-muted" };
}

function Next({ t }) {
  if (t.status === "assigned" || t.status === "revision") return <StartTask id={t.id} label={t.status === "revision" ? "Start fixing" : "Start"} />;
  if (t.status === "in_progress")
    return (
      <Link href={`/tasks/${t.id}`} className="btn-primary btn-sm relative z-[1]">
        <Icon name="upload" size={13} /> Upload & submit
      </Link>
    );
  const s = TASK_STATUSES[t.status];
  const label = { completed: "With your head", sent_to_client: "With the client", client_rejected: "Client asked for changes", done: "Approved" }[t.status] || s?.label;
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: s?.color }} />
      {label}
    </span>
  );
}

function Row({ t }) {
  const w = when(t);
  return (
    <li className="group relative flex items-center gap-3 rounded-2xl px-2.5 py-2.5 transition hover:bg-panel-2/70">
      <Link href={`/tasks/${t.id}`} className="absolute inset-0" aria-label={t.title} />
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full" style={{ background: `color-mix(in srgb, ${KIND_COLOR[t.kind] || "#94a3b8"} 16%, transparent)`, color: KIND_COLOR[t.kind] || "#94a3b8" }}>
        <Icon name={t.kind === "video" || t.kind === "reel" ? "video" : t.kind === "website" ? "link" : "file"} size={15} />
      </span>
      <div className="pointer-events-none min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium group-hover:text-brand">{t.title}</span>
          {t.revision > 0 && <span className="shrink-0 rounded-full bg-rose-400/15 px-1.5 text-[10px] font-semibold leading-4 text-rose-400">Revision {t.revision}</span>}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
          <span>{t.brand?.name}</span>
          <span className="h-1 w-1 rounded-full bg-faint" />
          <span>{taskKindLabel(t.kind)}</span>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${w.cls}`}>{w.text}</span>
        </div>
        {t.status === "revision" && t.feedback && <p className="mt-1.5 line-clamp-2 rounded-lg bg-rose-400/10 px-2.5 py-1.5 text-xs text-rose-300">“{t.feedback}”</p>}
      </div>
      <div className="relative z-[1] shrink-0">
        <Next t={t} />
      </div>
    </li>
  );
}

function Section({ title, sub, tasks, tone, empty }) {
  if (!tasks.length && !empty) return null;
  return (
    <section className="card min-w-0 p-3 sm:p-4">
      <header className="flex items-center gap-2 px-2 pb-2 pt-1">
        <h2 className="text-[15px] font-medium">{title}</h2>
        <span className="rounded-full px-1.5 text-[11px] font-semibold leading-5 tabular-nums" style={{ background: `color-mix(in srgb, ${tone} 14%, transparent)`, color: tone }}>
          {tasks.length}
        </span>
        {sub && <span className="ml-auto hidden truncate text-xs text-muted sm:block">{sub}</span>}
      </header>
      {tasks.length ? <ul className="flex flex-col">{tasks.map((t) => <Row key={t.id} t={t} />)}</ul> : <p className="px-3 pb-3 text-xs text-muted">{empty}</p>}
    </section>
  );
}

export default function MyWork({ me, tasks }) {
  const today = dayKey(now());
  const weekEnd = dayKey(now() + 7 * 86400000);
  const open = tasks.filter((t) => OPEN_TASK.includes(t.status));
  const late = (t) => t.due_at && new Date(t.due_at).getTime() < now();
  const fix = open.filter((t) => t.status === "revision");
  const overdue = open.filter((t) => t.status !== "revision" && late(t));
  const rest = open.filter((t) => t.status !== "revision" && !late(t));
  const dueToday = rest.filter((t) => t.due_at && dayKey(t.due_at) === today);
  const week = rest.filter((t) => t.due_at && dayKey(t.due_at) > today && dayKey(t.due_at) <= weekEnd);
  const later = rest.filter((t) => !t.due_at || dayKey(t.due_at) > weekEnd);
  const waiting = tasks.filter((t) => ["completed", "sent_to_client", "client_rejected"].includes(t.status));
  const done = tasks
    .filter((t) => t.status === "done")
    .sort((a, b) => (b.done_at || "").localeCompare(a.done_at || ""))
    .slice(0, 8);
  const now_ = [...fix, ...overdue, ...dueToday];
  const coming = [...week, ...later];
  const first = me.name.split(" ")[0];

  return (
    <div className="flex flex-col gap-4">
      <header className="px-1">
        <h1 className="text-[34px] font-normal leading-tight tracking-[-0.03em] sm:text-[42px]">Hi {first} 👋</h1>
        <p className="mt-1 text-sm text-muted">Press Start when you begin. When it&apos;s ready, open the task, upload the file and submit.</p>
      </header>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard coral label="Do today" value={now_.length} note={now_.length ? "Fixes, late & due today" : "Nothing urgent"} />
        <StatCard label="Late" value={overdue.length} tone="#e11d48" note={overdue.length ? "Past the due date" : "Nothing late"} />
        <StatCard label="Coming up" value={coming.length} note="This week & later" />
        <StatCard label="Done" value={tasks.filter((t) => t.status === "done").length} bar={tasks.length ? Math.round((tasks.filter((t) => t.status === "done").length / tasks.length) * 100) : 0} />
      </div>

      {!tasks.length && (
        <div className="card">
          <Empty icon="tasks">No tasks yet. When someone assigns you work, it shows up here and on your phone.</Empty>
        </div>
      )}
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Section title="Do today" sub="Fixes, late work, due today" tasks={now_} tone="#e8654f" empty={open.length ? "Nothing for today — pick something from Coming up." : ""} />
        <Section title="Coming up" tasks={coming} tone="#3b82f6" empty={open.length ? "Nothing else planned." : ""} />
        <Section title="Waiting on others" sub="Your head or the client has it" tasks={waiting} tone="#8b5cf6" />
        <Section title="Done" tasks={done} tone="#10b981" />
      </div>
    </div>
  );
}
