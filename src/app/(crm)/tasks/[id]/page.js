import Link from "next/link";
import { notFound } from "next/navigation";
import Icon from "@/components/Icon";
import { Avatar, PageHeader, Panel } from "@/components/ui";
import { DueLabel, TaskStatusPill } from "@/components/Tasks";
import { ReviewPanel, StatusSelect, TaskAdmin, TaskFiles } from "@/components/TaskForms";
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
  const showFeedback = task.feedback && ["revision", "assigned", "in_progress"].includes(task.status);

  return (
    <div className="page max-w-6xl">
      <PageHeader back={head ? { href: `/brands/${task.brand_id}`, label: task.brand?.name || "Brand" } : { href: "/tasks", label: "My tasks" }} />

      <section className="rise card -mt-2 p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <span className="rounded-full bg-panel-2 px-2.5 py-1 font-medium">{taskKindLabel(task.kind)}</span>
          {head ? (
            <Link href={`/brands/${task.brand_id}`} className="hover:text-ink">
              {task.brand?.name}
            </Link>
          ) : (
            <span>{task.brand?.name}</span>
          )}
          {task.revision > 0 && <span className="rounded-full bg-rose-400/15 px-2 py-0.5 font-semibold text-rose-400">Revision {task.revision}</span>}
        </div>
        <h1 className="mt-3 text-[28px] font-medium leading-tight tracking-[-0.02em] md:text-[36px]">{task.title}</h1>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
          <TaskStatusPill status={task.status} />
          {task.priority && task.priority !== "medium" && (
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${task.priority === "high" ? "bg-red-500/15 text-red-400" : "bg-panel-2 text-muted"}`}>{task.priority === "high" ? "High priority" : "Low priority"}</span>
          )}
          <span className="inline-flex items-center gap-1.5">
            <Icon name="clock" size={14} />
            <DueLabel due={task.due_at} status={task.status} />
          </span>
          {task.assignee && (
            <span className="inline-flex items-center gap-1.5">
              <Avatar name={task.assignee.name} size={22} /> {task.assignee.name}
            </span>
          )}
          {task.assigner && <span className="text-xs">assigned by {task.assigner.name}</span>}
        </div>
      </section>

      <div className="rise rise-2 mt-5 grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="flex min-w-0 flex-col gap-5">
          {showFeedback && (
            <section className="tint-pink rounded-[var(--radius-card,28px)] p-5">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Icon name="refresh" size={15} /> What to change
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{task.feedback}</p>
            </section>
          )}
          <Panel title="Brief">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink/85">{task.brief || <span className="text-faint">No brief added.</span>}</p>
          </Panel>
          <Panel title="Work" sub={mine ? "Upload the work, then set the status to Completed" : "Files the team uploaded, by version"}>
            <TaskFiles task={task} canUpload={mine || head} />
          </Panel>
        </div>

        <div className="flex flex-col gap-5">
          {mine && (
            <Panel title="Status" sub="Update it as you go">
              <StatusSelect task={task} canChange />
            </Panel>
          )}
          {head && (
            <Panel title="Review">
              <ReviewPanel task={task} people={people} />
            </Panel>
          )}
          {head && (
            <Panel title="Details">
              <TaskAdmin task={task} people={people} />
            </Panel>
          )}
          <Panel title="History">
            <ol className="flex flex-col gap-3">
              {task.events.map((e) => (
                <li key={e.id} className="flex gap-3 text-sm">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand" />
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
          </Panel>
        </div>
      </div>
    </div>
  );
}
