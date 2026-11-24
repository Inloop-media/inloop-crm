import { notFound } from "next/navigation";
import TaskView from "@/components/TaskView";
import { requireMember } from "@/lib/auth";
import { getTask, listMakers, productionPeople } from "@/lib/tasks";
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
  const mine = task.assignee_id === me.id;
  const [people, crew] = await Promise.all([head ? listMakers(me) : [], (head || mine) && !["shoot", "posting"].includes(task.kind) ? productionPeople() : []]);
  return <TaskView task={task} head={head} mine={mine} people={people} crew={crew} />;
}
