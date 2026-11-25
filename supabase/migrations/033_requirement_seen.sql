-- 033: when each side last opened a requirement, so a reply / update shows as a number in the sidebar
-- until it's been looked at. Run once in Supabase → SQL Editor. Safe to run again.
alter table requirements add column if not exists from_seen_at timestamptz;
alter table requirements add column if not exists to_seen_at timestamptz;
