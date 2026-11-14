-- Inloop CRM — client logins
-- Run once in Supabase → SQL Editor → New query → paste → Run, after 009. Safe to run again.
-- When an admin marks a lead Won, the brand is onboarded straight away and gets a client login
-- (ID + password) that the admin shares with the brand from the dashboard. The client signs in on
-- /login → "Client login" and sees their own dashboard (/client): work to approve, and approved work.

create table if not exists client_accounts (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null unique references brands (id) on delete cascade,
  login_id text not null unique,
  auth_user_id uuid unique,
  -- Shown to admins so they can share it; only the server (service role) reads this table
  password text not null default '',
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

alter table client_accounts enable row level security;
