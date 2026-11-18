-- 015: departments with heads. Each group can have a head (e.g. Krish heads Designers, Video Editors,
-- Creative Strategists and Production; Udit heads Development, Performance and Social Media; Arushi
-- heads Sales). A head's dashboard, Tasks and Leads show their own team's work.
-- Run once in the Supabase SQL editor. Safe to run again.

alter table groups add column if not exists lead_id uuid references members(id) on delete set null;

-- New kinds of teams
alter table groups drop constraint if exists groups_kind_check;
alter table groups add constraint groups_kind_check
  check (kind in ('sales', 'strategy', 'execution', 'design', 'development', 'video', 'performance', 'social', 'production', 'other'));

insert into groups (name, kind)
select v.name, v.kind
from (values ('Performance', 'performance'), ('Social Media Management', 'social'), ('Production', 'production')) as v(name, kind)
where not exists (select 1 from groups g where g.kind = v.kind);
