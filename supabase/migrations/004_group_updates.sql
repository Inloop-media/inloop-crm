-- Inloop CRM — group updates feed (Slack-like posts inside the CRM)
-- Run once in Supabase → SQL Editor → New query → paste → Run, after 003. Safe to run again.

-- Which updates a group receives, e.g. {crl_ready, proposal_ready}
alter table groups add column if not exists notify text[] not null default '{}';

-- One post per update per group. Written by the CRM / the Mac bots, read by the group's members.
create table if not exists group_posts (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups (id) on delete cascade,
  lead_id uuid references leads (id) on delete set null,
  event text not null,
  title text not null,
  body text not null default '',
  url text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists group_posts_group_idx on group_posts (group_id, created_at desc);

-- When each member last opened each group's feed (for the unread count)
create table if not exists group_reads (
  group_id uuid not null references groups (id) on delete cascade,
  member_id uuid not null references members (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (group_id, member_id)
);

-- The CRL links group — rename, change or delete it under Team
insert into groups (name, kind, notify) values ('Inloop CRLs', 'other', '{crl_ready}')
on conflict (name) do nothing;

alter table group_posts enable row level security;
alter table group_reads enable row level security;
