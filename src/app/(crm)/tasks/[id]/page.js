import Link from "next/link";
import { notFound } from "next/navigation";
import Icon from "@/components/Icon";
import { Avatar, PageHeader, Panel } from "@/components/ui";
import { DueLabel, TaskStatusPill } from "@/components/Tasks";
import { HoldPanel, ReviewPanel, StatusSelect, TaskAdmin, TaskFiles } from "@/components/TaskForms";
import { requireMember } from "@/lib/auth";
import { getTask, listMakers } from "@/lib/tasks";
import { canAssignTasks } from "@/lib/permissions";
import { taskKindLabel } from "@/lib/constants";
import { ago, fmtDateTime } from "@/lib/format";

export async function generateMetadata({ params }) {
  const { id } = await params;
  const me = await requireMember();
  const t = await getTask(me, id);
  return { title: t ? t.title : "Task" };
}

const EVENT = {
  created: (d) => `Assigned to ${d.to || "—"}`,
  edited: (d) => (d.to ? `Reassigned to ${d.to}` : "Task details changed"),
  status: (d) => `Status: ${d.to?.replace("_", " ")}`,
  file: (d) => `Uploaded ${d.name}`,
  note: () => "Added a note",
  hold: (d) => `Put on hold — ${d.reason || ""}`,
  resume: () => "Resumed",
  reference: (d) => `Added reference ${d.name}`,
  send_back: () => "Sent back for revision",
  share_client: () => "Shared with the client",
  approve: () => "Approved",
  client_ok: () => "Client approved",
  client_changes: () => "Client asked for changes",
  reassign: (d) => `Revision ${d.revision || ""} assigned`,
};

export default async function TaskPage({ params }) {
  const { id } = await params;
  const me = await requireMember();
  const task = await getTask(me, id);
  if (!task) notFound();
  const head = canAssignTasks(me);
  const mine = task.assignee_id === me.id;
  const people = head ? await listMakers(me) : [];
  const refs = task.files.filter((f) => f.role === "reference");
  const showFeedback = task.feedback && ["revision", "assigned", "in_progress"].includes(task.status);

  return (
    <div className="page max-w-6xl">
      <PageHeader back={head ? { href: `/brands/${task.brand_id}`, label: task.brand?.name || "Brand" } : { href: "/tasks", label: "My tasks" }} />

      <header className="rise -mt-2 mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <TaskStatusPill status={task.status} />
          {task.priority === "high" && <span className="rounded-full bg-rose-500/12 px-2.5 py-1 text-[11px] font-medium text-rose-500">Urgent</span>}
          {task.revision > 0 && <span className="rounded-full bg-panel-2 px-2.5 py-1 text-[11px] font-medium text-muted">Version {task.revision + 1}</span>}
        </div>
        <h1 className="mt-3 text-[28px] font-medium leading-tight tracking-[-0.025em] md:text-[32px]">{task.title}</h1>
        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted">
          <span>{taskKindLabel(task.kind)}</span>
          <span className="text-faint">·</span>
          {head ? (
            <Link href={`/brands/${task.brand_id}`} className="hover:text-ink">
              {task.brand?.name}
            </Link>
          ) : (
            <span>{task.brand?.name}</span>
          )}
          <span className="text-faint">·</span>
          <DueLabel due={task.due_at} status={task.status} />
          {task.assignee && (
            <>
              <span className="text-faint">·</span>
              <span className="inline-flex items-center gap-1.5">
                <Avatar name={task.assignee.name} size={18} /> {task.assignee.name}
              </span>
            </>
          )}
          {task.assigner && <span className="text-faint">(given by {task.assigner.name.split(" ")[0]})</span>}
        </p>
      </header>

      <div className="rise rise-2 grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-5">
          {showFeedback && (
            <section className="tint-pink rounded-[var(--radius-card,28px)] p-5">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Icon name="refresh" size={15} /> What to change
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{task.feedback}</p>
            </section>
          )}
          {(task.brief || refs.length > 0) && (
            <Panel title="Brief">
              {task.brief && <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink/85">{task.brief}</p>}
              {refs.length > 0 && (
                <div className={task.brief ? "mt-4" : ""}>
                  <p className="mb-2 text-xs font-medium text-muted">Files from {task.assigner?.name.split(" ")[0] || "the person who gave it"}</p>
                  <ul className="flex flex-col gap-1.5">
                    {refs.map((f) => (
                      <li key={f.id}>
                        <a href={f.href} target="_blank" rel="noreferrer" className="flex items-center gap-2.5 rounded-xl bg-panel-2 px-3 py-2.5 text-sm transition hover:bg-panel-3">
                          <Icon name={f.storage_path ? "file" : "link"} size={15} className="text-muted" />
                          <span className="min-w-0 flex-1 truncate">{f.name}</span>
                          <Icon name="download" size={14} className="text-muted" />
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Panel>
          )}
          <Panel title="Work" sub={mine ? "Upload the work, add a link or write a note — then mark it Completed." : "Files, links and notes for this task, by version."}>
            <TaskFiles task={task} canUpload={mine || head} />
          </Panel>
        </div>

        <div className="flex flex-col gap-5">
          {(mine || head) && (
            <Panel title="Next step">
              <div className="flex flex-col gap-4">
                {task.status !== "on_hold" && mine && <StatusSelect task={task} canChange />}
                {task.status !== "on_hold" && head && <ReviewPanel task={task} people={people} />}
                <HoldPanel task={task} heldBy={task.events.find((e) => e.type === "hold")?.actor?.name || ""} />
              </div>
            </Panel>
          )}
          {head && (
            <details className="card group p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between text-[15px] font-medium">
                Edit details
                <Icon name="chevron" size={14} className="text-muted transition group-open:rotate-180" />
              </summary>
              <div className="mt-4">
                <TaskAdmin task={task} people={people} />
              </div>
            </details>
          )}
          <details className="card group p-5" open={task.events.length <= 4}>
            <summary className="flex cursor-pointer list-none items-center justify-between text-[15px] font-medium">
              <span>
                History <span className="font-normal text-muted">{task.events.length}</span>
              </span>
              <Icon name="chevron" size={14} className="text-muted transition group-open:rotate-180" />
            </summary>
            <ol className="mt-4 flex flex-col gap-3">
              {task.events.map((e) => (
                <li key={e.id} className="flex gap-3 text-[13px]">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-faint" />
                  <div className="min-w-0">
                    <div>{(EVENT[e.type] || (() => e.type))(e.data || {})}</div>
                    {e.data?.feedback && <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs text-muted">{e.data.feedback}</p>}
                    <div className="mt-0.5 text-[11px] text-faint" title={fmtDateTime(e.created_at)}>
                      {e.actor?.name || e.data?.by || "CRM"} · {ago(e.created_at)}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </details>
        </div>
      </div>
    </div>
  );
}
