-- Inloop CRM — folders inside the brand library sections
-- Run once in Supabase → SQL Editor → New query → paste → Run, after 025. Safe to run again.
-- e.g. Brand identity → Logos / Fonts / Brand guidelines. A file's folder is kept on the file
-- (subfolder, "" = not in a folder); folders someone creates before adding files are kept here.

alter table brand_assets add column if not exists subfolder text not null default '';
create index if not exists brand_assets_sub on brand_assets (brand_id, folder, subfolder);

create table if not exists brand_asset_folders (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands (id) on delete cascade,
  folder text not null,
  name text not null,
  created_by uuid references members (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (brand_id, folder, name)
);
alter table brand_asset_folders enable row level security;
