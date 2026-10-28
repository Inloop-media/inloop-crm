-- Inloop CRM — database schema
-- Run once in Supabase → SQL Editor → New query → paste → Run.
-- All reads/writes go through the Next.js server with the service-role key, so RLS is switched on
-- with no policies: the public (anon) key can't read or write anything directly.

create extension if not exists pgcrypto;

-- People who can sign in. Only emails listed here (plus ADMIN_EMAILS in the env) get in.
create table if not exists members (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text not null,
  role text not null check (role in ('admin', 'ops', 'executive')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  lead_no bigint generated always as identity unique,
  code text generated always as ('IM-' || lead_no::text) stored,
  first_name text not null default '',
  last_name text not null default '',
  phone text not null default '',
  email text not null default '',
  brand text not null default '',
  location text not null default '',
  service text not null default '',
  budget text not null default '',
  details text not null default '',
  newsletter boolean not null default false,
  source text not null default 'website',
  status text not null default 'New Lead',
  assigned_to uuid references members (id) on delete set null,
  assigned_at timestamptz,
  remarks text not null default '',
  brief text not null default '',
  -- Set when the status first becomes "Client Brief Shared to Ops Team"
  handed_to_ops_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leads_assigned_to_idx on leads (assigned_to);
create index if not exists leads_status_idx on leads (status);
create index if not exists leads_created_at_idx on leads (created_at desc);

-- History shown on each lead (created, status changes, assignment, notes…)
create table if not exists lead_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads (id) on delete cascade,
  actor_id uuid references members (id) on delete set null,
  type text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists lead_events_lead_idx on lead_events (lead_id, created_at desc);

alter table members enable row level security;
alter table leads enable row level security;
alter table lead_events enable row level security;

-- Meetings + Google Calendar connection (also in migrations/002_meetings.sql for existing projects)
alter table members add column if not exists google_refresh_token text;
alter table members add column if not exists calendar_connected_at timestamptz;

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
