-- Inloop CRM — chat attachments + read receipts
-- Run once in Supabase → SQL Editor → New query → paste → Run, after 011. Safe to run again.

-- Photos, videos, PDFs … sent in the chat: [{ path, name, size, type }] (files live in the lead-docs bucket under chat/)
alter table brand_messages add column if not exists attachments jsonb not null default '[]'::jsonb;
-- A message can be just a file
alter table brand_messages alter column body set default '';

-- How far each reader has read a brand's chat: reader = a member id, or 'client' for the brand.
-- Drives the ✓✓ ticks, the "unread" line and the unread counts.
create table if not exists brand_chat_reads (
  brand_id uuid not null references brands (id) on delete cascade,
  reader text not null,
  read_at timestamptz not null default now(),
  primary key (brand_id, reader)
);

alter table brand_chat_reads enable row level security;
