-- 034: content-calendar sheet columns the CRM has no field for (Content Pillar, Hook, …) are kept as they
-- are in the sheet — same names, same order — and show on the post. Run once in Supabase → SQL Editor.
alter table calendar_items add column if not exists extra jsonb not null default '[]'::jsonb;
