-- Kyro — direct messages between a person and their head / team lead (and between heads),
-- plus a team lead for every group (picked by the group's head).
-- Sales executives share leads here as a "lead card"; the sales head adds it to the CRM in one click.
-- Run once in Supabase → SQL Editor → New query → paste → Run, after 017. Safe to run again.

create table if not exists direct_messages (
  id uuid primary key default gen_random_uuid(),
  from_id uuid not null references members (id) on delete cascade,
  to_id uuid not null references members (id) on delete cascade,
  body text not null default '',
  attachments jsonb not null default '[]'::jsonb,   -- [{ path, name, size, type }] in the lead-docs bucket
  kind text not null default 'text' check (kind in ('text', 'lead')),
  meta jsonb not null default '{}'::jsonb,           -- lead card: { brand, name, phone, email, service, details, lead_id, lead_code }
  read_at timestamptz,                               -- when the receiver saw it
  created_at timestamptz not null default now()
);
create index if not exists direct_messages_pair on direct_messages (from_id, to_id, created_at desc);
create index if not exists direct_messages_inbox on direct_messages (to_id, read_at);

alter table direct_messages enable row level security;

-- Each group's team lead (e.g. the senior designer), chosen by the head. Their group can message them directly.
alter table groups add column if not exists team_lead_id uuid references members (id) on delete set null;
