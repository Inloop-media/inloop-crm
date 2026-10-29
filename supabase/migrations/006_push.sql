-- Inloop CRM — phone / desktop push notifications
-- Run once in Supabase → SQL Editor → New query → paste → Run, after 005. Safe to run again.
-- One row per device that turned notifications on.

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_member_idx on push_subscriptions (member_id);

alter table push_subscriptions enable row level security;
