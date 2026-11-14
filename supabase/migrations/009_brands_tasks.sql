-- Inloop CRM — Phase 2: brands (onboarding + MOU) and task management
-- Run once in Supabase → SQL Editor → New query → paste → Run, after 008. Safe to run again.
--
-- A lead that is Won becomes a brand: the MOU is drafted from the template + the client's services,
-- sent, signed, and the brand is onboarded (everyone gets the "Welcome to the Loop" celebration).
-- Execution heads then assign tasks on the brand to designers / developers / video editors.

/* ------------------------------- Team groups ------------------------------ */
alter table groups drop constraint if exists groups_kind_check;
alter table groups add constraint groups_kind_check
  check (kind in ('sales', 'strategy', 'execution', 'design', 'development', 'video', 'other'));

insert into groups (name, kind)
select v.name, v.kind from (values
  ('Execution Heads', 'execution'),
  ('Designers', 'design'),
  ('Developers', 'development'),
  ('Video Editors', 'video')
) as v(name, kind)
where not exists (select 1 from groups g where g.kind = v.kind);

/* --------------------------------- Brands -------------------------------- */
create table if not exists brands (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null unique references leads (id) on delete cascade,
  name text not null,
  -- mou_draft → mou_sent → active
  stage text not null default 'mou_draft' check (stage in ('mou_draft', 'mou_sent', 'active')),
  services jsonb not null default '[]'::jsonb,   -- [{ name, scope, fee, billing }]
  terms jsonb not null default '{}'::jsonb,      -- client legal name, address, signatory, start date, months …
  mou_version int not null default 0,
  mou_sent_at timestamptz,
  signed_at timestamptz,
  onboarded_at timestamptz,
  created_by uuid references members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists brands_stage_idx on brands (stage);

-- MOU PDFs (as sent, and the signed copy back from the client) live with the lead's documents
alter table lead_documents drop constraint if exists lead_documents_kind_check;
alter table lead_documents add constraint lead_documents_kind_check
  check (kind in ('reference_links', 'creatives', 'brand_strategy', 'brand_identity', 'output', 'mou', 'mou_signed'));

/* ------------------------------ Celebrations ----------------------------- */
-- One row per onboarded brand; every member sees the pop-up once.
create table if not exists celebrations (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references brands (id) on delete cascade,
  title text not null,
  body text not null default '',
  created_at timestamptz not null default now()
);
alter table members add column if not exists celebrations_seen_at timestamptz not null default now();

/* ---------------------------------- Tasks -------------------------------- */
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands (id) on delete cascade,
  title text not null,
  kind text not null default 'post' check (kind in ('post', 'carousel', 'reel', 'story', 'video', 'design', 'website', 'other')),
  brief text not null default '',
  assignee_id uuid references members (id) on delete set null,
  assigned_by uuid references members (id) on delete set null,
  due_at timestamptz,
  -- assigned → in_progress → completed (waits for the head's review)
  --   head: revision (back to the employee) | sent_to_client | done (internal work)
  --   client: done (approved) | client_rejected (back to the head, who reassigns → revision)
  status text not null default 'assigned' check (status in
    ('assigned', 'in_progress', 'completed', 'revision', 'sent_to_client', 'client_rejected', 'done')),
  revision int not null default 0,
  feedback text not null default '',
  due_soon_notified_at timestamptz,
  overdue_notified_at timestamptz,
  completed_at timestamptz,
  done_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tasks_brand_idx on tasks (brand_id, status);
create index if not exists tasks_assignee_idx on tasks (assignee_id, status);
create index if not exists tasks_assigned_by_idx on tasks (assigned_by, status);
create index if not exists tasks_due_idx on tasks (due_at) where status not in ('done', 'sent_to_client');

-- Deliverables (and reference files) on a task, per revision
create table if not exists task_files (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks (id) on delete cascade,
  revision int not null default 0,
  role text not null default 'deliverable' check (role in ('deliverable', 'reference')),
  name text not null default '',
  storage_path text not null default '',
  url text not null default '',
  size bigint not null default 0,
  uploaded_by uuid references members (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists task_files_task_idx on task_files (task_id, created_at);

-- Everything that happened on a task
create table if not exists task_events (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks (id) on delete cascade,
  actor_id uuid references members (id) on delete set null,
  type text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists task_events_task_idx on task_events (task_id, created_at desc);

alter table brands enable row level security;
alter table celebrations enable row level security;
alter table tasks enable row level security;
alter table task_files enable row level security;
alter table task_events enable row level security;
