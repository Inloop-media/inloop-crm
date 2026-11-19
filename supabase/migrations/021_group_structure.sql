-- Kyro — groups with managers and team leads (any number), and groups that come under a CBO (Chief Business Officer).
-- Run once in Supabase → SQL Editor → New query → paste → Run, after 020_brand_library.sql.
--
-- Tip: add the people (Team page) BEFORE running this — anyone already on the team is put in the right
-- group automatically (matched by name). Anyone added later you place on the Team page.

/* ------------------------------ Columns ------------------------------ */
-- head_ids = the group's managers (for the CBO group: the CBOs)
alter table groups add column if not exists head_ids uuid[] not null default '{}';
alter table groups add column if not exists team_lead_ids uuid[] not null default '{}';
-- The CBO this group comes under (Udit sir / Krish sir / Arushi ma'am). With no manager of its own, they manage it.
alter table groups add column if not exists owner_id uuid references members (id) on delete set null;

-- Older single head / team lead (migrations 015, 018) carry over
update groups set head_ids = array[lead_id] where lead_id is not null and head_ids = '{}';
update groups set team_lead_ids = array[team_lead_id] where team_lead_id is not null and team_lead_ids = '{}';

/* ---------------------------- Fresh start ---------------------------- */
-- Runs only once: if the "CBO" group already exists, nothing below touches your groups again.
do $$
declare
  ops uuid; sales uuid; dev uuid; cs uuid; perf uuid; smm uuid; des uuid; vid uuid; prod uuid;
  udit uuid; krish uuid; arushi uuid;
begin
  if exists (select 1 from groups where name in ('CBO', 'Operations')) then
    return;
  end if;

  -- Every group goes except "Inloop CRLs" (its people, tasks and leads stay — only the groups go)
  delete from groups where name <> 'Inloop CRLs';

  -- One active member whose name starts like this, or null (none, or more than one)
  create temporary table _p on commit drop as select id, lower(name) as n from members where active;

  select (select id from _p where n like 'udit%' limit 1) into udit where (select count(*) from _p where n like 'udit%') = 1;
  select (select id from _p where n like 'kr%sh%' limit 1) into krish where (select count(*) from _p where n like 'kr%sh%') = 1;

  select (select id from _p where n like 'arushi%' limit 1) into arushi where (select count(*) from _p where n like 'arushi%') = 1;

  -- The CBOs (Chief Business Officers) — comes under Admin
  insert into groups (name, kind, head_ids) values ('CBO', 'execution', array_remove(array[udit, krish, arushi], null)) returning id into ops;

  -- Under Arushi ma'am (no manager of its own, so she manages it)
  insert into groups (name, kind, owner_id) values ('Sales', 'sales', arushi) returning id into sales;
  -- Under Udit sir
  insert into groups (name, kind, owner_id) values ('Development', 'development', udit) returning id into dev;
  insert into groups (name, kind, owner_id) values ('Creative Strategists', 'strategy', udit) returning id into cs;
  insert into groups (name, kind, owner_id) values ('Performance', 'performance', udit) returning id into perf;
  insert into groups (name, kind, owner_id) values ('Social Media Management', 'social', udit) returning id into smm;
  -- Under Krish sir
  insert into groups (name, kind, owner_id) values ('Designers', 'design', krish) returning id into des;
  insert into groups (name, kind, owner_id) values ('Video Editors', 'video', krish) returning id into vid;
  insert into groups (name, kind, owner_id) values ('Production', 'production', krish) returning id into prod;

  -- Who is in which group: (group, name pattern, role, not this pattern) — role 'head' (= manager; for CBO: a CBO), 'lead' (team lead) or 'member'
  create temporary table _plan (g uuid, pat text, role text, nopat text default '-') on commit drop;
  insert into _plan (g, pat, role) values
    (sales, 'arushi%', 'member'), (sales, 'avneet%', 'member'),
    (ops, 'udit%', 'member'), (ops, 'kr%sh%', 'member'), (ops, 'arushi%', 'member'),
    (dev, 'karan%', 'head'), (dev, 'nandini%', 'head'),
    (cs, 'abhay%', 'lead'),
    (smm, 'nilav%', 'lead'),
    (des, 'ananya%', 'lead'), (des, 'kumkum%', 'member'), (des, 'mansi%', 'member'),
    (vid, 'ananya%', 'lead'), (vid, 'sachin%', 'member'), (vid, 'sudhanshu%', 'member'),
    (prod, 'aryan saini%', 'lead'), (prod, 'sarthika%', 'member');
  -- the Aryan in sales is not Aryan Saini
  insert into _plan values (sales, 'aryan%', 'member', 'aryan saini%');

  -- One person per plan row: their name matches the pattern (and not nopat), and only one person does
  create temporary table _hit on commit drop as
  select pl.g, pl.role, min(p.id::text)::uuid as id
  from _plan pl join _p p on p.n like pl.pat and p.n not like pl.nopat
  group by pl.g, pl.role, pl.pat, pl.nopat
  having count(*) = 1;

  -- Everyone matched joins the group (heads and team leads too)
  insert into group_members (group_id, member_id) select g, id from _hit on conflict do nothing;

  update groups gr set head_ids = coalesce((select array_agg(distinct id) from _hit where g = gr.id and role = 'head'), '{}')
  where gr.id in (sales, dev, cs, perf, smm, des, vid, prod);
  update groups gr set team_lead_ids = coalesce((select array_agg(distinct id) from _hit where g = gr.id and role = 'lead'), '{}')
  where gr.id in (sales, dev, cs, perf, smm, des, vid, prod);

  -- Keep the old single columns in step for anything that still reads them
  update groups set lead_id = head_ids[1], team_lead_id = team_lead_ids[1];
end $$;
