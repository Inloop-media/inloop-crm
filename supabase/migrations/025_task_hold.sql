-- Inloop CRM — put a task on hold
-- Run once in Supabase → SQL Editor → New query → paste → Run, after 024. Safe to run again.
-- A manager (or the person doing it) can pause a task — e.g. to make room for something urgent.
-- A reason is required; the task goes back to where it was when it's resumed.

alter table tasks drop constraint if exists tasks_status_check;
alter table tasks add constraint tasks_status_check check (status in
  ('assigned', 'in_progress', 'completed', 'revision', 'sent_to_client', 'client_rejected', 'done', 'on_hold'));

alter table tasks add column if not exists hold_reason text not null default '';
alter table tasks add column if not exists held_from text;
alter table tasks add column if not exists held_at timestamptz;
alter table tasks add column if not exists held_by uuid references members (id) on delete set null;
