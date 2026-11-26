// A team lead's view of their team (e.g. Ananya → designers and video editors): who has what, person by
// person — what's late, what they're on, what's waiting. Server component.
import { Avatar } from "@/components/ui";
import { Section, TaskLine } from "@/components/Desk";
import { leadTeamTasks } from "@/lib/tasks";
import { leadTeam } from "@/lib/permissions";
import { OPEN_TASK, byPriority } from "@/lib/constants";

const nowMs = () => Date.now();

export default async function TeamTasks({ me }) {
  if (!leadTeam(me).length) return null;
  const tasks = await leadTeamTasks(me).catch(() => []);
  const now = nowMs();
  const late = (t) => OPEN_TASK.includes(t.status) && t.due_at && new Date(t.due_at).getTime() < now;
  const people = Object.values(
    tasks.reduce((acc, t) => {
      const id = t.assignee_id;
      (acc[id] ||= { id, name: t.assignee?.name || "Someone", tasks: [] }).tasks.push(t);
      return acc;
    }, {}),
  ).sort((a, b) => b.tasks.filter(late).length - a.tasks.filter(late).length || a.name.localeCompare(b.name));

  return (
    <Section title="Your team's tasks" count={tasks.length} empty="Nobody in your team has work right now.">
      {people.map((p) => {
        const open = p.tasks.filter((t) => OPEN_TASK.includes(t.status));
        const lateN = p.tasks.filter(late).length;
        return (
          <div key={p.id} className="mt-3 first:mt-1">
            <div className="mb-1 flex items-center gap-2 text-[13px] font-medium">
              <Avatar name={p.name} size={22} />
              {p.name}
              <span className="text-[12px] font-normal text-muted">
                {open.length} open{lateN ? ` · ` : ""}
                {lateN ? <span className="text-rose-500">{lateN} late</span> : null}
              </span>
            </div>
            {[...p.tasks].sort((a, b) => Number(late(b)) - Number(late(a)) || byPriority(a, b)).map((t) => (
              <TaskLine key={t.id} t={t} showAssignee={false} showStatus />
            ))}
          </div>
        );
      })}
    </Section>
  );
}
