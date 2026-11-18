-- 016: the full content brief on each calendar post, matching the team's Google Sheet:
-- content idea (title), type, notes, creative brief, creative direction, caption direction,
-- content copy (caption), CTA objective and any number of references.
-- Run once in the Supabase SQL editor. Safe to run again.

alter table calendar_items
  add column if not exists creative_brief text not null default '',
  add column if not exists creative_direction text not null default '',
  add column if not exists caption_direction text not null default '',
  add column if not exists cta_objective text not null default '',
  add column if not exists refs jsonb not null default '[]'::jsonb;
