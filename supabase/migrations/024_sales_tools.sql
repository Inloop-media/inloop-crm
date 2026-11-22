-- Inloop CRM — sales tools
-- Run once in Supabase → SQL Editor → New query → paste → Run, after 023. Safe to run again.
--   1. Extra phone numbers / emails on a lead (when the client gives a different one than the form)
--   2. Brand assets: company profiles, presentations and past work the sales team uses to pitch
--   3. A faster lookup of meetings by time (to stop two calls being booked in the same slot)

alter table leads add column if not exists extra_contacts jsonb not null default '[]'::jsonb;

create table if not exists sales_assets (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  kind text not null default 'other' check (kind in ('profile', 'presentation', 'work', 'other')),
  note text not null default '',
  storage_path text not null default '',
  url text not null default '',
  file_name text not null default '',
  size bigint not null default 0,
  created_by uuid references members (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists sales_assets_created_idx on sales_assets (created_at desc);
-- Only the server (service role) reads this table
alter table sales_assets enable row level security;

create index if not exists meetings_starts_idx on meetings (starts_at) where cancelled_at is null;
