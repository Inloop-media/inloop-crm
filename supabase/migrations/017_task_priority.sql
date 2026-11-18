-- 017: a priority on every task (high / medium / low). Employees see high-priority work first.
-- Run once in the Supabase SQL editor. Safe to run again.
alter table tasks add column if not exists priority text not null default 'medium';
alter table tasks drop constraint if exists tasks_priority_check;
alter table tasks add constraint tasks_priority_check check (priority in ('high', 'medium', 'low'));
