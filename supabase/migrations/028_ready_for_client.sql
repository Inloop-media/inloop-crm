-- 028: "Ready for client" — the team lead approved the work; a CBO (Udit sir) downloads it and shares it
-- with the client by hand (the client dashboard is paused). Safe to run again.
alter table tasks drop constraint if exists tasks_status_check;
alter table tasks add constraint tasks_status_check check (status in
  ('assigned', 'in_progress', 'completed', 'ready', 'revision', 'sent_to_client', 'client_rejected', 'done', 'on_hold'));
