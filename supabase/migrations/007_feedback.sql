-- Inloop CRM — feedback from the team about the CRM itself
-- Run once in Supabase → SQL Editor → New query → paste → Run, after 006. Safe to run again.
-- Anyone except admins can send a note; admins read them on /feedback.

create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references members (id) on delete set null,
  mood smallint check (mood between 1 and 5),
  kind text not null default 'general' check (kind in ('problem', 'idea', 'general')),
  message text not null,
  page text not null default '',
  status text not null default 'new' check (status in ('new', 'seen', 'done')),
  created_at timestamptz not null default now()
);

create index if not exists feedback_created_idx on feedback (created_at desc);
create index if not exists feedback_status_idx on feedback (status);

alter table feedback enable row level security;
