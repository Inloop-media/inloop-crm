-- Inloop CRM — admin review of the proposal deck
-- Run once in Supabase → SQL Editor → New query → paste → Run, after 007. Safe to run again.
-- The proposal bot's deck now lands in "proposal_review": the admin approves it or sends feedback,
-- and the bot rebuilds the deck as the next version with that feedback.

alter table proposals add column if not exists feedback text not null default '';
alter table proposals add column if not exists revision int not null default 0;
