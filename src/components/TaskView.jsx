// One task, laid out like a project tool: the title and where it stands (a progress line), the brief,
// the work and the activity on the left; what to do now and the details on the right.
import Link from "next/link";
import Icon from "@/components/Icon";
import { Avatar } from "@/components/ui";
import { HoldPanel, MainAction, ReviewPanel, TaskAdmin, TaskFiles } from "@/components/TaskForms";
import RawRequest from "@/components/RawRequest";
import PostKit from "@/components/PostKit";
import { KIND_COLOR, OPEN_TASK, TASK_STATUSES, taskKindLabel } from "@/lib/constants";
import { ago, fmtDateTime } from "@/lib/format";

export const EVENT = {
  created: (d) => `gave it to ${d.to || "—"}`,
  edited: (d) => (d.to ? `reassigned it to ${d.to}` : "changed the details"),
  status: (d) => `moved it to ${TASK_STATUSES[d.to]?.label || String(d.to || "").replace("_", " ")}`,
  file: (d) => `uploaded ${d.name}`,
  note: () => "added a note",
  hold: () => "put it on hold",
  resume: () => "picked it back up",
  reference: (d) => `added ${d.name}`,
  send_back: () => "sent it back for changes",
  share_client: () => "shared it with the client",
  ready: () => "approved it — ready for the client",
  approve: () => "approved it",
  client_ok: () => "marked it approved by the client",
  client_changes: () => "sent it back — the client asked for changes",
  reassign: (d) => `gave revision ${d.revision || ""}`,
  raw_requested: (d) => `asked ${d.to || "Production"} for ${d.what || "raw files"}`,
  raw_ready: () => "uploaded the raw files from the shoot",
  posted: () => "marked it posted",
  unposted: () => "undid the post",
};

const RAW_STATE = {
  assigned: ["Waiting for the shoot", "bg-amber-500/12 text-amber-600 dark:text-amber-400"],
  in_progress: ["Shooting now", "bg-sky-500/12 text-sky-600 dark:text-sky-400"],
  revision: ["Re-shoot asked", "bg-rose-500/12 text-rose-500"],
  on_hold: ["On hold", "bg-panel-2 text-muted"],
};
const rawReady = (r) => ["completed", "client_rejected", "sent_to_client", "done"].includes(r.status);
const isImg = (n) => /\.(jpe?g|png|webp|gif|heic)$/i.test(n || "");
const isVid = (n) => /\.(mp4|mov|webm|m4v)$/i.test(n || "");

/** The raw photos / footage asked from Production for this task, with what they uploaded. */
function RawFiles({ raws }) {
  return (
    <section className="rounded-[22px] border border-line bg-panel p-6 shadow-[0_1px_2px_rgb(16_24_40/0.04),0_8px_24px_-12px_rgb(16_24_40/0.12)]">
      <header className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold tracking-[-0.01em]">
          <Icon name="video" size={15} className="text-brand" /> Raw from Production
        </h2>
        <span className="text-[12px] text-muted">{raws.filter(rawReady).length} of {raws.length} ready</span>
      </header>
      <ul className="flex flex-col gap-4">
        {raws.map((r) => {
          const ready = rawReady(r);
          const [label, cls] = ready ? ["Uploaded", "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400"] : RAW_STATE[r.status] || [r.status, "bg-panel-2 text-muted"];
          const latest = r.files.filter((f) => f.revision === Math.max(...r.files.map((x) => x.revision)));
          const media = latest.filter((f) => f.storage_path);
          const links = latest.filter((f) => !f.storage_path);
          const notes = r.notes || [];
          return (
            <li key={r.id} className="rounded-2xl bg-panel-2/60 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">{r.title}</span>
                <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ${cls}`}>
                  {ready && <Icon name="check" size={11} />}
                  {label}
                </span>
              </div>
              <p className="mt-1 flex items-center gap-1.5 text-[12px] text-muted">
                <Avatar name={r.assignee?.name || "?"} size={18} /> {r.assignee?.name || "Production"}
                {r.due_at && !ready && <> · needed by {dueFmt.format(new Date(r.due_at))}</>}
              </p>
              {links.length > 0 && (
                <ul className="mt-3 flex flex-col gap-2">
                  {links.map((f) => (
                    <li key={f.id}>
                      <a href={f.href} target="_blank" rel="noreferrer" className="group flex items-center gap-3 rounded-xl border border-line bg-panel px-3 py-2.5 text-[13px] transition hover:border-brand/40">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand">
                          <Icon name="link" size={14} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{/drive\.google|docs\.google/.test(f.href) ? "Google Drive" : /dropbox/.test(f.href) ? "Dropbox" : f.name}</span>
                          <span className="block truncate text-[11.5px] text-muted">{f.href}</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-1 text-[12px] font-medium text-brand">
                          Open <Icon name="external" size={12} />
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
              {notes.map((n) => (
                <p key={n.id} className="mt-3 whitespace-pre-wrap rounded-xl bg-panel px-3 py-2.5 text-[13px] text-ink/85">
                  <span className="mb-0.5 block text-[11px] text-muted">{n.actor?.name?.split(" ")[0] || "Production"}&apos;s note</span>
                  {n.data.text}
                </p>
              ))}
              {media.length > 0 ? (
                <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                  {media.map((f) => (
                    <li key={f.id}>
                      <a href={f.href} target="_blank" rel="noreferrer" className="group block overflow-hidden rounded-xl border border-line bg-panel transition hover:border-brand/40">
                        {isImg(f.name) && f.href ? (
                          // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
                          <img src={f.href} alt={f.name} className="aspect-[4/3] w-full object-cover" loading="lazy" />
                        ) : isVid(f.name) && f.href ? (
                          <video src={f.href} className="aspect-[4/3] w-full bg-black object-cover" muted playsInline preload="metadata" />
                        ) : (
                          <span className="grid aspect-[4/3] place-items-center text-muted">
                            <Icon name={f.storage_path ? "file" : "link"} size={18} />
                          </span>
                        )}
                        <span className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11.5px]">
                          <span className="min-w-0 flex-1 truncate">{f.name}</span>
                          <Icon name="download" size={12} className="text-muted group-hover:text-brand" />
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                !links.length &&
                !notes.length && <p className="mt-3 rounded-xl border border-dashed border-line-strong px-3 py-2.5 text-[12px] text-faint">Files show up here when {r.assignee?.name.split(" ")[0] || "they"} uploads them.</p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const STEPS = ["To do", "In progress", "Submitted", "Ready for client", "Shared", "Approved"];
const STEP_OF = { assigned: 0, revision: 0, in_progress: 1, completed: 2, client_rejected: 2, ready: 3, sent_to_client: 4, done: 5 };
const IST = "Asia/Kolkata";
const dueFmt = new Intl.DateTimeFormat("en-IN", { timeZone: IST, day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const nowMs = () => Date.now();

/** Where the task is: To do → In progress → Submitted → With client → Approved. */
function Stepper({ status }) {
  const at = STEP_OF[status] ?? 0;
  const held = status === "on_hold";
  return (
    <ol className="flex items-center gap-2 overflow-x-auto">
      {STEPS.map((s, i) => {
        const done = i < at || status === "done";
        const now = i === at && status !== "done";
        return (
          <li key={s} className="flex flex-1 items-center gap-2">
            <span
              className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12px] font-semibold transition ${
                done ? "bg-emerald-500 text-white" : now ? (held ? "bg-slate-400 text-white ring-4 ring-slate-400/20" : "bg-amber-400 text-white ring-4 ring-amber-400/20") : "bg-panel-2 text-faint"
              }`}
            >
              {done ? <Icon name="check" size={13} /> : i + 1}
            </span>
            <span className={`whitespace-nowrap text-[12.5px] ${now ? "font-semibold text-ink" : done ? "text-ink/70" : "text-faint"}`}>
              {s}
              {now && held && <span className="font-normal text-muted"> · on hold</span>}
            </span>
            {i < STEPS.length - 1 && <span className={`h-[2px] min-w-4 flex-1 rounded-full ${done ? "bg-emerald-500" : "bg-line"}`} />}
          </li>
        );
      })}
    </ol>
  );
}

function Prop({ label, children }) {
  return (
    <div className="flex items-center gap-3 border-b border-line py-3 last:border-0">
      <span className="w-24 shrink-0 text-[12.5px] text-muted">{label}</span>
      <span className="flex min-w-0 flex-1 items-center gap-2 text-[13.5px]">{children}</span>
    </div>
  );
}

function Card({ title, sub, children, className = "" }) {
  return (
    <section className={`rounded-[22px] border border-line bg-panel p-6 shadow-[0_1px_2px_rgb(16_24_40/0.04),0_8px_24px_-12px_rgb(16_24_40/0.12)] ${className}`}>
      {title && (
        <header className="mb-4 flex items-baseline justify-between gap-3">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em]">{title}</h2>
          {sub && <span className="text-[12px] text-muted">{sub}</span>}
        </header>
      )}
      {children}
    </section>
  );
}

/**
 *   task    getTask(): with files, events, brand, assignee, assigner
 *   head    may manage tasks (review, edit)
 *   mine    the viewer is doing this task
 *   people  who it can be given to (for heads)
 */
export default function TaskView({ task, head, mine, people = [], crew = [] }) {
  const refs = task.files.filter((f) => f.role === "reference");
  const showFeedback = task.feedback && ["revision", "assigned", "in_progress"].includes(task.status);
  const st = TASK_STATUSES[task.status] || { label: task.status, color: "#94a3b8" };
  const kc = KIND_COLOR[task.kind] || "#64748b";
  const lateMs = task.due_at && OPEN_TASK.includes(task.status) ? nowMs() - new Date(task.due_at).getTime() : 0;
  const lateDays = lateMs > 0 ? Math.floor(lateMs / 864e5) : -1;
  const heldBy = task.events.find((e) => e.type === "hold")?.actor?.name || "";
  const raws = task.raws || [];
  const waitingRaw = raws.filter((r) => !rawReady(r));
  const back = head ? { href: "/tasks", label: "Tasks" } : { href: "/tasks", label: "My tasks" };

  return (
    <div className="page !max-w-[1440px]">
      <nav className="rise mb-4 flex items-center gap-1.5 text-[13px] text-muted">
        <Link href={back.href} className="flex items-center gap-1.5 hover:text-ink">
          <Icon name="tasks" size={13} /> {back.label}
        </Link>
        <Icon name="chevron" size={12} className="-rotate-90 text-faint" />
        {head ? (
          <Link href={`/brands/${task.brand_id}`} className="hover:text-ink">
            {task.brand?.name}
          </Link>
        ) : (
          <span>{task.brand?.name}</span>
        )}
      </nav>

      <div className="rise grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-5">
          {/* Title + where it stands */}
          <section className="relative overflow-hidden rounded-[22px] border border-line bg-panel p-7 shadow-[0_1px_2px_rgb(16_24_40/0.04),0_8px_24px_-12px_rgb(16_24_40/0.12)]">
            <span className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full blur-3xl" style={{ background: `color-mix(in srgb, ${st.color} 18%, transparent)` }} />
            <div className="relative flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11.5px] font-semibold" style={{ background: `color-mix(in srgb, ${kc} 12%, transparent)`, color: kc }}>
                {taskKindLabel(task.kind)}
              </span>
              {task.priority === "high" && <span className="rounded-lg bg-rose-500/10 px-2 py-1 text-[11.5px] font-semibold text-rose-500">Urgent</span>}
              {lateDays >= 0 && <span className="rounded-lg bg-rose-500/10 px-2 py-1 text-[11.5px] font-semibold text-rose-500">{lateDays ? `${lateDays} day${lateDays > 1 ? "s" : ""} late` : "Late"}</span>}
              {task.revision > 0 && <span className="rounded-lg bg-panel-2 px-2 py-1 text-[11.5px] font-semibold text-muted">Version {task.revision + 1}</span>}
            </div>
            <h1 className="relative mt-3 text-[30px] font-semibold leading-tight tracking-[-0.025em] md:text-[34px]">{task.title}</h1>
            <div className="relative mt-7">
              <Stepper status={task.status} />
            </div>
          </section>

          {showFeedback && (
            <section className="rounded-[22px] border border-rose-400/30 bg-rose-500/[0.06] p-6">
              <p className="flex items-center gap-2 text-[14px] font-semibold text-rose-600 dark:text-rose-400">
                <Icon name="refresh" size={15} /> What to change
              </p>
              <p className="mt-2 whitespace-pre-wrap text-[14.5px] leading-relaxed">{task.feedback}</p>
            </section>
          )}

          {task.forTask && (
            <section className="flex items-center gap-4 rounded-[22px] bg-[#18181b] p-5 text-white shadow-[0_24px_50px_-28px_rgb(0_0_0/0.7)]">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand text-white">
                <Icon name="video" size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11.5px] text-white/60">This shoot is for</p>
                <p className="truncate text-[15px] font-medium">{task.forTask.title}</p>
                <p className="text-[12px] text-white/60">
                  {task.forTask.assignee?.name || "The team"} is waiting — upload the raw files and press Submit; they&apos;re notified right away.
                </p>
              </div>
              {head && (
                <Link href={`/tasks/${task.forTask.id}`} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/15 hover:bg-white/25" aria-label="Open that task">
                  <Icon name="arrow" size={14} className="-rotate-45" />
                </Link>
              )}
            </section>
          )}

          {task.kind === "posting" && task.post_item_id && (
            <section className="rounded-[22px] border border-line bg-panel p-6 shadow-[0_1px_2px_rgb(16_24_40/0.04),0_8px_24px_-12px_rgb(16_24_40/0.12)]">
              <PostKit itemId={task.post_item_id} />
            </section>
          )}

          {raws.length > 0 && <RawFiles raws={raws} />}

          {(task.brief || refs.length > 0) && (
            <Card title="Brief">
              {task.brief && <p className="whitespace-pre-wrap text-[14.5px] leading-relaxed text-ink/85">{task.brief}</p>}
              {refs.length > 0 && (
                <div className={task.brief ? "mt-5" : ""}>
                  <p className="mb-2 text-[12px] font-medium text-muted">Files from {task.assigner?.name.split(" ")[0] || "the person who gave it"}</p>
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {refs.map((f) => (
                      <li key={f.id}>
                        <a href={f.href} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl border border-line bg-panel-2/60 px-3 py-2.5 text-[13px] transition hover:border-brand/40">
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-panel text-muted">
                            <Icon name={f.storage_path ? "file" : "link"} size={14} />
                          </span>
                          <span className="min-w-0 flex-1 truncate">{f.name}</span>
                          <Icon name="download" size={14} className="text-muted" />
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          )}

          <Card title={mine ? "Your work" : "Work"} sub={mine ? "Files, a link or a note — then submit" : "Files, links and notes, by version"}>
            <TaskFiles task={task} canUpload={mine || head} />
          </Card>

          <Card title="Activity" sub={`${task.events.length} update${task.events.length === 1 ? "" : "s"}`}>
            <ol className="relative flex flex-col gap-5 before:absolute before:bottom-2 before:left-[13px] before:top-2 before:w-px before:bg-line">
              {task.events.map((e) => (
                <li key={e.id} className="relative flex gap-3">
                  <span className="relative z-[1] rounded-full ring-4 ring-panel">
                    <Avatar name={e.actor?.name || e.data?.by || "CRM"} size={28} />
                  </span>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <p className="text-[13.5px]">
                      <span className="font-medium">{e.actor?.name || e.data?.by || "CRM"}</span> <span className="text-ink/75">{(EVENT[e.type] || (() => e.type))(e.data || {})}</span>
                    </p>
                    {(e.data?.feedback || e.data?.reason || (e.type === "note" && e.data?.text)) && <p className="mt-1.5 line-clamp-4 whitespace-pre-wrap rounded-xl bg-panel-2 px-3 py-2 text-[13px] text-ink/80">{e.data.feedback || e.data.reason || e.data.text}</p>}
                    <p className="mt-0.5 text-[11.5px] text-faint" title={fmtDateTime(e.created_at)}>
                      {ago(e.created_at)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        {/* Right: what to do now + the details */}
        <aside className="flex flex-col gap-5 lg:sticky lg:top-4">
          <Card>
            <div className="flex flex-col gap-3">
              {mine && task.kind !== "posting" && <MainAction task={task} />}
              {mine && task.kind === "posting" && task.status !== "done" && <p className="text-center text-[12.5px] text-muted">Post it, then press “Mark as posted” in the post kit.</p>}
              {head && !mine && task.status !== "on_hold" && <ReviewPanel task={task} people={people} />}
              {head && mine && ["completed", "ready", "client_rejected", "sent_to_client"].includes(task.status) && <ReviewPanel task={task} people={people} />}
              {head && !mine && OPEN_TASK.includes(task.status) && <p className="text-center text-[12px] text-muted">{task.assignee?.name.split(" ")[0] || "They"} is on it — you&apos;ll be notified when it&apos;s submitted.</p>}
              {mine && waitingRaw.length > 0 && (
                <p className="flex items-start gap-2 rounded-xl bg-amber-500/10 px-3 py-2.5 text-[12.5px] text-amber-700 dark:text-amber-300">
                  <Icon name="clock" size={14} className="mt-0.5 shrink-0" />
                  Waiting for raw files from {waitingRaw.map((r) => r.assignee?.name.split(" ")[0]).filter(Boolean).join(", ") || "Production"} — you&apos;ll get a notification when they&apos;re uploaded.
                </p>
              )}
              <HoldPanel task={task} heldBy={heldBy} />
            </div>
          </Card>

          {(head || mine) && !["shoot", "posting"].includes(task.kind) && task.status !== "done" && (
            <Card>
              <RawRequest task={task} crew={crew} mine={mine} />
            </Card>
          )}

          <Card className="!py-2">
            <Prop label="Status">
              <span className="flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-[12.5px] font-medium" style={{ background: `color-mix(in srgb, ${st.color} 15%, transparent)`, color: `color-mix(in oklab, ${st.color} 65%, var(--color-ink))` }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: st.color }} />
                {st.label}
              </span>
            </Prop>
            <Prop label="Assignee">
              {task.assignee ? (
                <>
                  <Avatar name={task.assignee.name} size={22} /> {task.assignee.name}
                </>
              ) : (
                <span className="text-faint">Nobody</span>
              )}
            </Prop>
            <Prop label="Due">
              {task.due_at ? <span className={lateDays >= 0 ? "font-medium text-rose-500" : ""}>{dueFmt.format(new Date(task.due_at))}</span> : <span className="text-faint">No date</span>}
            </Prop>
            <Prop label="Priority">
              <span className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${task.priority === "high" ? "bg-rose-500" : task.priority === "low" ? "bg-slate-400" : "bg-amber-400"}`} />
                {task.priority === "high" ? "Urgent" : task.priority === "low" ? "Low" : "Normal"}
              </span>
            </Prop>
            <Prop label="Brand">
              <span className="grid h-5 w-5 place-items-center rounded-md bg-ink text-[10px] font-bold text-panel">{(task.brand?.name || "?")[0]}</span>
              {head ? (
                <Link href={`/brands/${task.brand_id}`} className="truncate hover:text-brand">
                  {task.brand?.name}
                </Link>
              ) : (
                <span className="truncate">{task.brand?.name}</span>
              )}
            </Prop>
            <Prop label="Type">{taskKindLabel(task.kind)}</Prop>
            {task.assigner && (
              <Prop label="Given by">
                <Avatar name={task.assigner.name} size={22} /> {task.assigner.name}
              </Prop>
            )}
          </Card>

          {head && (
            <details className="group rounded-[22px] border border-line bg-panel p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between text-[14px] font-semibold">
                Edit details
                <Icon name="chevron" size={14} className="text-muted transition group-open:rotate-180" />
              </summary>
              <div className="mt-4">
                <TaskAdmin task={task} people={people} />
              </div>
            </details>
          )}
        </aside>
      </div>
    </div>
  );
}
