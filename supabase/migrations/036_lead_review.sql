-- 036: team lead check. When someone in a team with a team lead (e.g. Ananya for Designers / Video Editors)
-- completes a task, their team lead checks it first; only after she approves does it reach the manager's
-- (e.g. Krish sir's) "To check". Run once in Supabase → SQL Editor. Safe to run again.
alter table tasks add column if not exists lead_ok_at timestamptz;
alter table tasks add column if not exists lead_ok_by uuid references members (id) on delete set null;
