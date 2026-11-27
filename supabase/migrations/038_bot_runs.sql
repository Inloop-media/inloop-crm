-- Bots tab: run a bot on its own, outside the lead flow (first one: the CRL bot).
-- Upload the brand-identity PDF + content-reference PDF → the Mac worker builds and publishes the CRL → the link shows here.
-- Nothing here touches leads, proposals or the lead `jobs` queue.

create table if not exists bot_runs (
  id uuid primary key default gen_random_uuid(),
  bot text not null default 'crl' check (bot in ('crl')),
  name text not null,
  identity_path text not null,
  content_path text not null,
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed')),
  progress text not null default '',
  result_url text,
  error text,
  worker text,
  attempts int not null default 0,
  created_by uuid references members(id) on delete set null,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  heartbeat_at timestamptz,
  finished_at timestamptz
);
create index if not exists bot_runs_created_idx on bot_runs (created_at desc);
alter table bot_runs enable row level security;

-- The Mac worker takes the oldest waiting run (and picks up runs whose worker went quiet for 15 minutes)
create or replace function claim_bot_run(p_worker text, p_bots text[])
returns setof bot_runs
language plpgsql
as $$
begin
  update bot_runs set status = 'queued'
  where status = 'running' and coalesce(heartbeat_at, started_at) < now() - interval '15 minutes';

  return query
  update bot_runs set status = 'running', worker = p_worker, attempts = attempts + 1,
                      started_at = now(), heartbeat_at = now(), progress = 'Started', error = null
  where id = (
    select id from bot_runs
    where status = 'queued' and bot = any (p_bots)
    order by created_at
    limit 1
    for update skip locked
  )
  returning *;
end;
$$;
revoke execute on function claim_bot_run(text, text[]) from public, anon, authenticated;
grant execute on function claim_bot_run(text, text[]) to service_role;
