-- 035: Google Drive. The company Drive (tech@) is connected once; every brand gets the same folder tree
-- there, and work uploaded on a task goes straight into the Drive folders the task was given. The CRM
-- keeps only the links. Run once in Supabase → SQL Editor. Safe to run again.

-- Small key → value settings (the Drive connection lives here; the token never leaves the server)
create table if not exists app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table app_settings enable row level security;

-- Every Drive folder the CRM made, per brand, with its path ("Ad Creatives / Static Ads")
create table if not exists drive_folders (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references brands (id) on delete cascade,
  drive_id text not null unique,
  parent_drive_id text,
  name text not null,
  path text not null,
  created_by uuid references members (id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index if not exists drive_folders_brand_path on drive_folders (brand_id, path);
alter table drive_folders enable row level security;

-- The folders a task's work goes into, each with a note ("front + back raw photos")
create table if not exists task_folders (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks (id) on delete cascade,
  drive_id text not null,
  path text not null default '',
  note text not null default '',
  sort int not null default 0,
  created_at timestamptz not null default now(),
  unique (task_id, drive_id)
);
create index if not exists task_folders_task on task_folders (task_id, sort);
alter table task_folders enable row level security;

-- A file uploaded to Drive from a task: which folder and which Drive file
alter table task_files add column if not exists drive_file_id text;
alter table task_files add column if not exists drive_folder_id text;
