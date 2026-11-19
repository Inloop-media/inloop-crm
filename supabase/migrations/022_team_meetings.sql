-- Kyro — team meetings: a team lead / manager / CBO books a Google Meet with whole groups or one person.
-- Everyone invited gets the calendar invite with the Meet link on their own email, and sees it on their dashboard.
-- Run once in Supabase → SQL Editor → New query → paste → Run, after 021_group_structure.sql. Safe to run again.

create table if not exists team_meetings (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  agenda text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  organizer_id uuid references members (id) on delete set null,
  group_ids uuid[] not null default '{}',   -- groups picked when booking (for the label only)
  meet_link text not null default '',
  event_id text not null default '',
  cancelled_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists team_meetings_starts_idx on team_meetings (starts_at);

-- One row per person invited (group members are expanded into people when the meeting is booked)
create table if not exists team_meeting_people (
  meeting_id uuid not null references team_meetings (id) on delete cascade,
  member_id uuid not null references members (id) on delete cascade,
  primary key (meeting_id, member_id)
);
create index if not exists team_meeting_people_member_idx on team_meeting_people (member_id);

alter table team_meetings enable row level security;
alter table team_meeting_people enable row level security;
