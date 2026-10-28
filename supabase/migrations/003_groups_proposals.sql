-- Inloop CRM — groups, new statuses, proposal pipeline (docs → CRL → commercials → strategy doc + deck)
-- Run once in Supabase → SQL Editor → New query → paste → Run, after 002_meetings.sql. Safe to run again.

/* ---------------------------- Access levels ---------------------------- */
-- admin  = everything incl. Team & Groups
-- ops    = like admin, without Team & Groups
-- member = what they can do comes from their groups (Sales executives, Creative strategists…)
alter table members drop constraint if exists members_role_check;
update members set role = 'member' where role not in ('admin', 'ops', 'member');
alter table members add constraint members_role_check check (role in ('admin', 'ops', 'member'));

/* -------------------------------- Groups ------------------------------- */
create table if not exists groups (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  -- sales    → get leads assigned, status up to Discovery Call, book the discovery call
  -- strategy → see shared briefs, pick one up, upload the 4 documents
  -- other    → just a label for now
  kind text not null check (kind in ('sales', 'strategy', 'other')),
  created_at timestamptz not null default now()
);

create table if not exists group_members (
  group_id uuid not null references groups (id) on delete cascade,
  member_id uuid not null references members (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (group_id, member_id)
);

insert into groups (name, kind) values ('Sales Executives', 'sales'), ('Creative Strategists', 'strategy')
on conflict (name) do nothing;

-- Everyone who was an executive before goes into Sales Executives
insert into group_members (group_id, member_id)
select g.id, m.id from groups g, members m
where g.name = 'Sales Executives' and m.role = 'member'
on conflict do nothing;

/* ------------------------------- Statuses ------------------------------ */
update leads set status = case status
  when 'Meeting Scheduled' then 'Discovery Call'
  when 'In-Person Meeting' then 'Discovery Call'
  when 'Client Brief Shared to Ops Team' then 'Proposal Meeting Scheduled'
  when 'Proposal Deck in Making' then 'Proposal Meeting Scheduled'
  when 'Strategy / Proposal Discussion' then 'Proposal Meeting Scheduled'
  when 'Awaiting Client Decision' then 'Waiting Client Decision'
  when 'Lost Lead' then 'Lost'
  else status end;

/* --------------------------- Proposal pipeline ------------------------- */
-- One per lead. Created when the proposal meeting is booked (the brief goes to the strategists).
create table if not exists proposals (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null unique references leads (id) on delete cascade,
  -- brief_shared → picked_up → crl_queued → crl_running → awaiting_commercials
  --   → proposal_queued → proposal_running → done      (crl_failed / proposal_failed on errors)
  stage text not null default 'brief_shared',
  shared_at timestamptz not null default now(),
  strategist_id uuid references members (id) on delete set null,
  picked_up_at timestamptz,
  submitted_at timestamptz,
  crl_url text not null default '',
  crl_ready_at timestamptz,
  commercials text not null default '',
  commercials_by uuid references members (id) on delete set null,
  commercials_at timestamptz,
  strategy_doc_url text not null default '',
  deck_url text not null default '',
  done_at timestamptz,
  error text not null default '',
  updated_at timestamptz not null default now()
);
create index if not exists proposals_stage_idx on proposals (stage);

-- The 4 inputs the strategist uploads: a file in the lead-docs bucket or a link
create table if not exists lead_documents (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads (id) on delete cascade,
  kind text not null check (kind in ('reference_links', 'creatives', 'brand_strategy', 'brand_identity', 'output')),
  name text not null default '',
  storage_path text not null default '',
  url text not null default '',
  size bigint not null default 0,
  uploaded_by uuid references members (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists lead_documents_lead_idx on lead_documents (lead_id, kind);

/* -------------------------- Jobs for the Mac bots ---------------------- */
-- The worker on Karan's Mac (inloop-crl/crl-bot/crm_worker.py) claims these through /api/worker/*.
create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads (id) on delete cascade,
  type text not null check (type in ('crl', 'proposal')),
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed')),
  progress text not null default '',
  result jsonb not null default '{}'::jsonb,
  error text not null default '',
  worker text not null default '',
  attempts int not null default 0,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  heartbeat_at timestamptz
);
create index if not exists jobs_queue_idx on jobs (status, type, created_at);

-- Hands the oldest queued job of the given types to one worker. Jobs whose worker went silent
-- for 15 minutes are handed out again.
create or replace function claim_job(p_worker text, p_types text[])
returns setof jobs
language plpgsql
as $$
begin
  update jobs set status = 'queued'
  where status = 'running' and coalesce(heartbeat_at, started_at) < now() - interval '15 minutes';

  return query
  update jobs set status = 'running', worker = p_worker, attempts = attempts + 1,
                  started_at = now(), heartbeat_at = now(), progress = 'Started'
  where id = (
    select id from jobs
    where status = 'queued' and type = any (p_types)
    order by created_at
    limit 1
    for update skip locked
  )
  returning *;
end;
$$;
revoke execute on function claim_job(text, text[]) from public, anon, authenticated;
grant execute on function claim_job(text, text[]) to service_role;

/* ------------------------------- Storage ------------------------------- */
insert into storage.buckets (id, name, public, file_size_limit)
values ('lead-docs', 'lead-docs', false, 52428800)
on conflict (id) do nothing;

alter table groups enable row level security;
alter table group_members enable row level security;
alter table proposals enable row level security;
alter table lead_documents enable row level security;
alter table jobs enable row level security;
