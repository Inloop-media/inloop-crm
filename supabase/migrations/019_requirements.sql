-- Kyro — requirements: a team member asks their team lead / head for something (a tool, equipment, access,
-- assets, help…) and both sides track it until it's done.
-- Run once in Supabase → SQL Editor → New query → paste → Run, after 018. Safe to run again.

create table if not exists requirements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  details text not null default '',
  category text not null default 'other',
  priority text not null default 'medium' check (priority in ('high', 'medium', 'low')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'done', 'rejected')),
  from_id uuid not null references members (id) on delete cascade,
  to_id uuid not null references members (id) on delete cascade,
  needed_by date,
  history jsonb not null default '[]'::jsonb,   -- [{ at, by, type: created|status|forward|note, ... }]
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz
);
create index if not exists requirements_to on requirements (to_id, status);
create index if not exists requirements_from on requirements (from_id, status);

alter table requirements enable row level security;
