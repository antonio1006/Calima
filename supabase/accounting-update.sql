-- Run this before deploying the accounting page on an existing Supabase project.

alter table public.events
add column if not exists walk_in_price_cents integer not null default 0;

alter table public.events
drop constraint if exists events_walk_in_price_cents_check;

alter table public.events
add constraint events_walk_in_price_cents_check
check (walk_in_price_cents >= 0);
