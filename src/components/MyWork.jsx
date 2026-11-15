// The employee's day: what to fix, what's late, what's due today / this week / later, and what's
// waiting on someone else. One clear next step on every row.
import Link from "next/link";
import Icon from "@/components/Icon";
import { Empty } from "@/components/ui";
import StartTask from "@/components/StartTask";
import { OPEN_TASK, TASK_STATUSES, taskKindLabel } from "@/lib/constants";

const now = () => Date.now();
const IST = "Asia/Kolkata";
const dayKey = (d) => new Date(d).toLocaleDateString("en-CA", { timeZone: IST });
const short = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: IST });
const KIND_COLOR = { post: "#60a5fa", carousel: "#a78bfa", story: "#f472b6", reel: "#fbbf24", video: "#22d3ee", design: "#4ade80", website: "#94a3b8", other: "#94a3b8" };

function when(t) {
  if (!t.due_at) return { text: "No due date", cls: "text-faint" };
  const ms = new Date(t.due_at).getTime() - now();
  if (OPEN_TASK.includes(t.status) && ms < 0) {
    const d = Math.floor(-ms / 86400000);
    return { text: d ? `${d} day${d > 1 ? "s" : ""} late` : "Late today", cls: "text-rose-400 font-medium" };
  }
  if (OPEN_TASK.includes(t.status) && ms < 86400000) return { text: `Due in ${Math.max(1, Math.round(ms / 3600000))}h`, cls: "text-amber-400 font-medium" };
  return { text: `Due ${short.format(new Date(t.due_at))}`, cls: "text-muted" };
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
    <li className="group relative flex items-center gap-3 rounded-2xl px-3 py-3 transition hover:bg-panel-2/70 sm:px-4">
      <Link href={`/tasks/${t.id}`} className="absolute inset-0" aria-label={t.title} />
      <span className="h-10 w-1 shrink-0 rounded-full" style={{ background: KIND_COLOR[t.kind] || "#94a3b8" }} />
      <div className="pointer-events-none min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium group-hover:text-brand">{t.title}</span>
          {t.revision > 0 && <span className="shrink-0 rounded-full bg-rose-400/15 px-1.5 text-[10px] font-semibold leading-4 text-rose-400">Revision {t.revision}</span>}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
          <span>{t.brand?.name}</span>
          <span className="h-1 w-1 rounded-full bg-faint" />
          <span>{taskKindLabel(t.kind)}</span>
          <span className="h-1 w-1 rounded-full bg-faint" />
          <span className={w.cls}>{w.text}</span>
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
    <section className="card !rounded-3xl p-3 sm:p-4">
      <header className="flex items-baseline gap-2 px-2 pb-2 pt-1">
        {tone && <span className="h-2 w-2 translate-y-[-1px] rounded-full" style={{ background: tone }} />}
        <h2 className="text-sm font-medium">{title}</h2>
        <span className="text-xs tabular-nums text-muted">{tasks.length}</span>
        {sub && <span className="ml-auto hidden text-xs text-muted sm:block">{sub}</span>}
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
  const focus = fix.length + overdue.length + dueToday.length;
  const first = me.name.split(" ")[0];

  return (
    <div className="flex flex-col gap-4">
      <section className="card relative overflow-hidden !rounded-3xl p-6">
        <span className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full blur-3xl" style={{ background: "color-mix(in srgb, #8b93ff 20%, transparent)" }} />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-sm text-muted">Hi {first} 👋</p>
            <h2 className="mt-1 text-2xl font-medium tracking-[-0.02em] sm:text-[28px]">{focus ? `${focus} thing${focus > 1 ? "s" : ""} need you today` : open.length ? "You're on track today" : "All clear — nothing assigned right now"}</h2>
            <p className="mt-1 text-sm text-muted">Start a task when you pick it up, then upload the file and submit it for review.</p>
          </div>
          <dl className="grid grid-cols-4 gap-2 text-center">
            {[
              ["To fix", fix.length, fix.length ? "text-rose-400" : ""],
              ["Late", overdue.length, overdue.length ? "text-rose-400" : ""],
              ["Open", open.length, ""],
              ["Approved", tasks.filter((t) => t.status === "done").length, "text-emerald-400"],
            ].map(([l, v, c]) => (
              <div key={l} className="well min-w-[64px] px-3 py-2.5">
                <dd className={`text-xl font-medium tabular-nums ${c}`}>{v}</dd>
                <dt className="text-[10px] text-muted">{l}</dt>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {!tasks.length && (
        <div className="card">
          <Empty icon="tasks">No tasks yet. When a head assigns you something, it shows up here and on your phone.</Empty>
        </div>
      )}
      <Section title="Fix these first" sub="Sent back with feedback" tasks={fix} tone="#fb7185" />
      <Section title="Late" sub="Past the due date" tasks={overdue} tone="#fb7185" />
      <Section title="Due today" tasks={dueToday} tone="#fbbf24" empty={open.length ? "Nothing else due today." : ""} />
      <Section title="This week" tasks={week} tone="#60a5fa" />
      <Section title="Later" tasks={later} tone="#94a3b8" />
      <Section title="Waiting on others" sub="With your head or the client — nothing to do" tasks={waiting} tone="#a78bfa" />
      <Section title="Recently approved" tasks={done} tone="#4ade80" />
    </div>
  );
}
