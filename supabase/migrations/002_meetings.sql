-- Inloop CRM — meetings + Google Calendar connection
-- Run once in Supabase → SQL Editor → New query → paste → Run. Safe to run again.

-- Each member connects their own Google Calendar once; meetings are created from their account.
alter table members add column if not exists google_refresh_token text;
alter table members add column if not exists calendar_connected_at timestamptz;

-- discovery = first call booked by the executive (status must be "Discovery Call")
-- proposal  = booked by the ops team after the brief is handed over; executives never see these
create table if not exists meetings (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads (id) on delete cascade,
  kind text not null check (kind in ('discovery', 'proposal')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  meet_link text not null default '',
  event_id text not null default '',
  organizer_id uuid references members (id) on delete set null,
  attendees text[] not null default '{}',
  cancelled_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists meetings_lead_idx on meetings (lead_id, starts_at desc);
create index if not exists meetings_starts_idx on meetings (starts_at);

alter table meetings enable row level security;
