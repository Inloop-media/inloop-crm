-- 014: follow-up reminders on leads, and a log so daily digests go out once per person per day.
-- Run once in the Supabase SQL editor. Safe to run again.

-- A lead can carry one follow-up reminder: when to call, and a note for yourself.
alter table leads
  add column if not exists follow_up_at timestamptz,
  add column if not exists follow_up_note text not null default '',
  add column if not exists follow_up_notified_at timestamptz;

create index if not exists leads_follow_up_idx on leads (follow_up_at) where follow_up_at is not null;

-- Which digest (evening "tomorrow", morning "today / late") each person got on which day.
create table if not exists digest_log (
  member_id uuid not null references members(id) on delete cascade,
  kind text not null,
  day date not null,
  sent_at timestamptz not null default now(),
  primary key (member_id, kind, day)
);
alter table digest_log enable row level security;
