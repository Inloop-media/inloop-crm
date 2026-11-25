-- 032: My notes. Admin and the CBOs keep a private list of what's on their plate, on their dashboard.
-- Only the person who wrote a note sees it. Run once in Supabase → SQL Editor. Safe to run again.
create table if not exists my_notes (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members (id) on delete cascade,
  text text not null,
  done boolean not null default false,
  done_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists my_notes_member on my_notes (member_id, done, created_at);

alter table my_notes enable row level security;
