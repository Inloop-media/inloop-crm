-- Kyro — lock / unlock a brand's content calendar.
-- Locked (the default): no one can add, edit, move, import or delete posts. The creative strategists'
-- team lead (or admin) unlocks it to work on it, and locks it again when the work is done.
-- Run once in Supabase → SQL Editor → New query → paste → Run, after 022_team_meetings.sql. Safe to run again.

alter table brands add column if not exists calendar_unlocked_at timestamptz;  -- null = locked
alter table brands add column if not exists calendar_unlocked_by uuid references members (id) on delete set null;
