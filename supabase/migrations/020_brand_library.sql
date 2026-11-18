-- Kyro — a library for every brand: the client's brand identity, images, videos and documents, uploaded by
-- ops / admin and open to the whole team to view and download. Approved task deliverables show up in the
-- brand's "Completed work" folder automatically (read from task_files, nothing stored twice).
-- Run once in Supabase → SQL Editor → New query → paste → Run, after 019. Safe to run again.

create table if not exists brand_assets (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands (id) on delete cascade,
  folder text not null default 'other' check (folder in ('identity', 'images', 'videos', 'documents', 'other')),
  name text not null default '',
  storage_path text not null default '',   -- a file in the lead-docs bucket under library/{brand_id}/ …
  url text not null default '',            -- … or a link (Google Drive, Dropbox) for big files
  size bigint not null default 0,
  type text not null default '',
  uploaded_by uuid references members (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists brand_assets_brand on brand_assets (brand_id, folder, created_at desc);

alter table brand_assets enable row level security;

-- Who can open each brand's confidential "Documents" folder (agreements, pricing…). Everyone else sees it locked.
-- Turn it on per person on the Team page.
alter table members add column if not exists can_see_documents boolean not null default false;
