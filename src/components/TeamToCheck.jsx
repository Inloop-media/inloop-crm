// A team lead's queue (e.g. Ananya): her team's finished work waiting for her check. Server component.
import { Section, TaskLine } from "@/components/Desk";
import { leadQueue } from "@/lib/tasks";
import { leadTeam } from "@/lib/permissions";

export default async function TeamToCheck({ me }) {
  if (!leadTeam(me).length) return null;
  const tasks = await leadQueue(me).catch(() => []);
  if (!tasks.length) return null;
  return (
    <Section title="Your team's work to check" count={tasks.length}>
      {tasks.map((t) => (
        <TaskLine key={t.id} t={t} showBrand showAssignee />
      ))}
    </Section>
  );
}
