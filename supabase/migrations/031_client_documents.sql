-- 031: brand assets get a "Client documents" section — onboarding checklists and forms we send to clients
-- (e.g. the Razorpay documents list). The development team's managers upload them.
alter table sales_assets drop constraint if exists sales_assets_kind_check;
alter table sales_assets add constraint sales_assets_kind_check check (kind in ('profile', 'presentation', 'work', 'client', 'other'));
