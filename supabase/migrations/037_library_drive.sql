-- 037: Brand library on Google Drive. Library files (except the confidential Documents section) go into
-- "<Brand> / Brand Library / <Section> / <Folder>" on the company Drive; the CRM keeps the link.
-- Run once in Supabase → SQL Editor. Safe to run again.
alter table brand_assets add column if not exists drive_file_id text;
