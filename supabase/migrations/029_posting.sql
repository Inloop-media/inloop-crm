-- 029: posting. Once the client approves a calendar post, the Social Media team gets a "posting" task for it;
-- whoever posts it marks it posted (with the link) — that's the only way a calendar post becomes "posted".
alter table tasks drop constraint if exists tasks_kind_check;
alter table tasks add constraint tasks_kind_check
  check (kind in ('post', 'carousel', 'reel', 'story', 'video', 'design', 'website', 'shoot', 'posting', 'other'));

-- The calendar post a posting task is for
alter table tasks add column if not exists post_item_id uuid references calendar_items (id) on delete cascade;
create index if not exists tasks_post_item on tasks (post_item_id);

-- Who posted it, when, and where
alter table calendar_items add column if not exists posted_at timestamptz;
alter table calendar_items add column if not exists posted_by uuid references members (id) on delete set null;
alter table calendar_items add column if not exists post_url text not null default '';
