-- 030: announcements. Admin and the CBOs post a message (with a link or a photo / PDF if they like); it goes to
-- everyone's phone and pops up for each person in the CRM until they press "Got it". Who has seen it is kept.
create table if not exists announcements (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references members (id) on delete set null,
  title text not null default '',
  body text not null default '',
  link text not null default '',
  file_path text,
  file_name text not null default '',
  file_type text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists announcements_created on announcements (created_at desc);

create table if not exists announcement_reads (
  announcement_id uuid not null references announcements (id) on delete cascade,
  member_id uuid not null references members (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (announcement_id, member_id)
);

-- Only the server (service role) reads and writes these
alter table announcements enable row level security;
alter table announcement_reads enable row level security;
