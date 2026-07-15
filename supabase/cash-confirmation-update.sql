-- Run this after cash-entry-update.sql if your Supabase project is already live.

alter table public.tickets
add column if not exists cash_confirmed boolean not null default false;

alter table public.tickets
add column if not exists cash_confirmed_at timestamptz;

alter table public.tickets
add column if not exists cash_confirmed_by uuid references public.profiles(id) on delete set null;

update public.tickets
set cash_confirmed = false
where checked_in = false
  and cash_confirmed = true;
