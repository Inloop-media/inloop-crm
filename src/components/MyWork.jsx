// The employee's day: what to fix, what's late, what's due today / this week / later, and what's
// waiting on someone else. One clear next step on every row.
import Link from "next/link";
import Icon from "@/components/Icon";
import { Empty } from "@/components/ui";
import { Counts } from "@/components/Home";
import { Section, TaskLine } from "@/components/Desk";
import StartTask from "@/components/StartTask";
import { OPEN_TASK, TASK_STATUSES, byPriority, fromCalendar } from "@/lib/constants";

const now = () => Date.now();
const IST = "Asia/Kolkata";
const dayKey = (d) => new Date(d).toLocaleDateString("en-CA", { timeZone: IST });

function Next({ t }) {
  if (t.status === "assigned" || t.status === "revision") return <StartTask id={t.id} label={t.status === "revision" ? "Start fixing" : "Start"} />;
  if (t.status === "in_progress")
    return (
      <Link href={`/tasks/${t.id}`} className="btn-primary btn-sm relative z-[1]">
        <Icon name="upload" size={13} /> Upload & submit
      </Link>
    );
  const s = TASK_STATUSES[t.status];
  const label = { completed: "With your manager", sent_to_client: "With the client", client_rejected: "Client asked for changes", done: "Approved" }[t.status] || s?.label;
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: s?.color }} />
      {label}
    </span>
  );
}

function List({ title, sub, tasks, tone, empty }) {
  if (!tasks.length && !empty) return null;
  return (
    <Section title={title} count={tasks.length} tone={tone} empty={empty} action={sub && <span className="hidden text-xs text-muted sm:block">{sub}</span>}>
      {tasks.map((t) => (
        <TaskLine key={t.id} t={t} showAssignee={false} calendarTag={false} note={t.status === "revision" ? t.feedback : ""} action={OPEN_TASK.includes(t.status) ? <Next t={t} /> : undefined} />
      ))}
    </Section>
  );
}

/** embedded: only the task sections (the Home shows its own header and numbers) */
export default function MyWork({ me, tasks, embedded = false }) {
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
  // High priority first, whenever it was assigned
  const now_ = [...fix, ...overdue, ...dueToday].sort(byPriority);
  const coming = [...week, ...later].sort(byPriority);
  // Fixes, late and today's work first, then the rest by date
  const ordered = [...now_, ...coming];

  return (
    <div className="flex flex-col gap-4">
      {!embedded && (
        <Counts
          items={[
            { label: "Do today", value: now_.length, tone: "red" },
            { label: "Late", value: overdue.length, tone: "red" },
            { label: "Waiting on others", value: waiting.length },
          ]}
        />
      )}

      {!tasks.length && !embedded && (
        <div className="card">
          <Empty icon="tasks">No tasks yet. When someone assigns you work, it shows up here and on your phone.</Empty>
        </div>
      )}
      <div className={`grid items-start gap-4 ${embedded ? "" : "lg:grid-cols-2"}`}>
        <List title="Content calendar" sub="Posts and reels from the brands' calendars" tasks={ordered.filter(fromCalendar)} empty={open.length ? "No calendar work right now." : ""} />
        <List title="Other tasks" sub="Everything else you were given" tasks={ordered.filter((t) => !fromCalendar(t))} empty={open.length ? "No other tasks right now." : ""} />
        <List title="On hold" sub="Paused for now" tasks={tasks.filter((t) => t.status === "on_hold")} />
        <List title="Waiting on others" sub="Your manager or the client has it" tasks={waiting} tone="#8b5cf6" />
        <List title="Done" tasks={done} tone="#10b981" />
      </div>
    </div>
  );
}
