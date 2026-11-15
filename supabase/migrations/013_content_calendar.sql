-- Content calendar + monthly plan per brand.
--   brand_plans     what the brand gets each month (12 posts, 4 reels, …) — set by admin / execution heads
--   calendar_items  the content calendar: one row per planned piece of content, built by the strategists.
--                   An item becomes a task when a head assigns it (task_id links them).

create table if not exists brand_plans (
  brand_id uuid not null references brands(id) on delete cascade,
  month date not null,                       -- first day of the month
  targets jsonb not null default '{}'::jsonb, -- { "post": 12, "reel": 4, "story": 8 }
  notes text not null default '',
  updated_by uuid references members(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (brand_id, month)
);
alter table brand_plans enable row level security;

create table if not exists calendar_items (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  publish_on date not null,
  kind text not null default 'post',
  platform text not null default 'instagram',
  title text not null,
  caption text not null default '',
  notes text not null default '',
  status text not null default 'planned' check (status in ('planned', 'posted')),
  task_id uuid references tasks(id) on delete set null,
  created_by uuid references members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists calendar_items_brand_day on calendar_items (brand_id, publish_on);
create index if not exists calendar_items_task on calendar_items (task_id);
alter table calendar_items enable row level security;
