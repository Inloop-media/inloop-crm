-- Inloop CRM — brand chat (client ↔ team)
-- Run once in Supabase → SQL Editor → New query → paste → Run, after 010. Safe to run again.
-- One conversation per brand: the client writes from their dashboard (/client), admins / ops /
-- execution heads reply from the brand page (Chat tab).

create table if not exists brand_messages (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands (id) on delete cascade,
  -- The team member who wrote it; null when the client wrote it
  member_id uuid references members (id) on delete set null,
  from_client boolean not null default false,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists brand_messages_brand_idx on brand_messages (brand_id, created_at desc);

alter table brand_messages enable row level security;
