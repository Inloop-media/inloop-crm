import { notFound } from "next/navigation";
import TaskView from "@/components/TaskView";
import { requireMember } from "@/lib/auth";
import { getTask, listMakers } from "@/lib/tasks";
import { canAssignTasks } from "@/lib/permissions";

export async function generateMetadata({ params }) {
  const { id } = await params;
  const me = await requireMember();
  const t = await getTask(me, id);
  return { title: t ? t.title : "Task" };
}

export default async function TaskPage({ params }) {
  const { id } = await params;
  const me = await requireMember();
  const task = await getTask(me, id);
  if (!task) notFound();
  const head = canAssignTasks(me);
  const people = head ? await listMakers(me) : [];
  return <TaskView task={task} head={head} mine={task.assignee_id === me.id} people={people} />;
}
