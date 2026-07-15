-- Run this once in Supabase SQL Editor before using the Cassa mode.

alter table public.tickets
add column if not exists payment_method text;

alter table public.tickets
add column if not exists entry_mode text not null default 'list';

alter table public.tickets
drop constraint if exists tickets_payment_method_check;

alter table public.tickets
add constraint tickets_payment_method_check
check (payment_method is null or payment_method in ('pos', 'cash'));

alter table public.tickets
drop constraint if exists tickets_entry_mode_check;

alter table public.tickets
add constraint tickets_entry_mode_check
check (entry_mode in ('list', 'walk_in'));
