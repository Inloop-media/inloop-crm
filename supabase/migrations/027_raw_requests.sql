-- 027: raw photos / footage from Production for a design or video task.
-- A "shoot" task points at the task it's for (for_task_id). When production submits it, the designer /
-- editor of that task is notified and the files show on their task.
alter table tasks add column if not exists for_task_id uuid references tasks (id) on delete set null;
create index if not exists tasks_for_task on tasks (for_task_id);

alter table tasks drop constraint if exists tasks_kind_check;
alter table tasks add constraint tasks_kind_check
  check (kind in ('post', 'carousel', 'reel', 'story', 'video', 'design', 'website', 'shoot', 'other'));
