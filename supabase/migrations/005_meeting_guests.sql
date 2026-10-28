-- Inloop CRM — people who can be added as guests to a discovery call
-- Run once in Supabase → SQL Editor → New query → paste → Run, after 004. Safe to run again.
-- Executives pick guests by name; the emails stay on the server.

create table if not exists meeting_guests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  -- Pre-selected when an executive books a discovery call
  is_default boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into meeting_guests (name, email, is_default) values
  ('Arushi Pant', 'arushi@inloopmedia.com', true),
  ('Sarthak Garg', 'sarthak@amsglobal.io', false),
  ('Uditanshu Jayant', 'uditanshu@inloopmedia.com', false),
  ('Krish Garg', 'krrish.garg@inloopmedia.com', false),
  ('Karan Negi', 'karan.negi@inloopmedia.com', false),
  ('Nandini', 'nandini.kishore@dotix.io', false),
  ('Abhay', 'abhay.mishra@inloopmedia.com', false),
  ('Ananya', 'ananya.verma@inloopmedia.com', false)
on conflict (email) do nothing;

alter table meeting_guests enable row level security;
