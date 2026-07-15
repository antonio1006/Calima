-- Run this before deploying the simplified manual list flow.
-- Manual admin tickets now require only first_name and last_name.

alter table public.tickets
alter column birth_date drop not null;

alter table public.tickets
alter column email drop not null;

alter table public.tickets
alter column phone drop not null;

alter table public.tickets
drop constraint if exists tickets_birth_date_check;

alter table public.tickets
add constraint tickets_birth_date_check
check (birth_date is null or birth_date <= current_date - interval '13 years');

alter table public.tickets
drop constraint if exists tickets_phone_check;

alter table public.tickets
add constraint tickets_phone_check
check (phone is null or phone ~ '^\+?[0-9 ]{8,18}$');

alter table public.tickets
drop constraint if exists tickets_email_check;

alter table public.tickets
add constraint tickets_email_check
check (email is null or (email = lower(email) and email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'));
