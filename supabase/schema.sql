-- Calima production schema draft for Supabase/Postgres.
-- Run this from the Supabase SQL Editor after creating the project.

create extension if not exists "pgcrypto";

do $$
begin
  create type public.user_role as enum ('client', 'scanner', 'admin');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.ticket_status as enum ('pending', 'paid', 'cancelled', 'refunded');
exception
  when duplicate_object then null;
end $$;

alter type public.ticket_status add value if not exists 'accepted';
alter type public.ticket_status add value if not exists 'rejected';

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  full_name text not null,
  email text not null unique check (email = lower(email) and email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'),
  phone text,
  birth_date date,
  role public.user_role not null default 'client',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
add column if not exists birth_date date;

alter table public.profiles
drop constraint if exists profiles_birth_date_check;

alter table public.profiles
add constraint profiles_birth_date_check
check (birth_date is null or birth_date <= current_date - interval '13 years');

alter table public.profiles
drop constraint if exists profiles_phone_check;

alter table public.profiles
add constraint profiles_phone_check
check (phone is null or phone ~ '^\+?[0-9 ]{8,18}$');

alter table public.profiles
drop constraint if exists profiles_email_check;

alter table public.profiles
add constraint profiles_email_check
check (email = lower(email) and email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$');

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  event_date date not null,
  event_time time not null,
  city text not null,
  venue text not null,
  capacity integer not null check (capacity > 0),
  price_cents integer not null default 0 check (price_cents >= 0),
  walk_in_price_cents integer not null default 0 check (walk_in_price_cents >= 0),
  image_path text not null default 'calima-event-cover.svg',
  description text not null,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.events
add column if not exists walk_in_price_cents integer not null default 0;

alter table public.events
drop constraint if exists events_walk_in_price_cents_check;

alter table public.events
add constraint events_walk_in_price_cents_check
check (walk_in_price_cents >= 0);

create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  public_code text not null unique default upper('TCK-' || encode(gen_random_bytes(5), 'hex')),
  event_id uuid not null references public.events(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  first_name text not null,
  last_name text not null,
  birth_date date,
  email text check (email is null or (email = lower(email) and email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$')),
  phone text check (phone is null or phone ~ '^\+?[0-9 ]{8,18}$'),
  payment_status public.ticket_status not null default 'pending',
  payment_method text check (payment_method is null or payment_method in ('pos', 'cash')),
  entry_mode text not null default 'list' check (entry_mode in ('list', 'walk_in')),
  checked_in boolean not null default false,
  checked_in_at timestamptz,
  checked_in_by uuid references public.profiles(id) on delete set null,
  cash_confirmed boolean not null default false,
  cash_confirmed_at timestamptz,
  cash_confirmed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

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

alter table public.tickets
add column if not exists payment_method text;

alter table public.tickets
add column if not exists entry_mode text not null default 'list';

alter table public.tickets
add column if not exists cash_confirmed boolean not null default false;

alter table public.tickets
add column if not exists cash_confirmed_at timestamptz;

alter table public.tickets
add column if not exists cash_confirmed_by uuid references public.profiles(id) on delete set null;

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

insert into
  storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'eventi',
    'eventi',
    true,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
  )
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create index if not exists tickets_event_id_idx on public.tickets(event_id);
create index if not exists tickets_email_idx on public.tickets(lower(email));
create index if not exists profiles_role_idx on public.profiles(role);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists events_set_updated_at on public.events;
create trigger events_set_updated_at
before update on public.events
for each row execute function public.set_updated_at();

create or replace function public.create_ticket_atomic(
  p_event_id uuid,
  p_profile_id uuid,
  p_first_name text,
  p_last_name text,
  p_birth_date date,
  p_email text,
  p_phone text
)
returns public.tickets
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_event public.events;
  created_ticket public.tickets;
begin
  select *
  into selected_event
  from public.events
  where id = p_event_id and is_published = true
  for update;

  if selected_event.id is null then
    raise exception 'EVENT_NOT_FOUND';
  end if;

  if exists (
    select 1
    from public.tickets
    where
      event_id = p_event_id
      and lower(email) = lower(p_email)
      and payment_status::text in ('pending', 'accepted', 'paid')
  ) then
    raise exception 'TICKET_ALREADY_EXISTS';
  end if;

  insert into public.tickets (
    event_id,
    profile_id,
    first_name,
    last_name,
    birth_date,
    email,
    phone,
    payment_status
  )
  values (
    p_event_id,
    p_profile_id,
    p_first_name,
    p_last_name,
    p_birth_date,
    lower(p_email),
    p_phone,
    'pending'::public.ticket_status
  )
  returning * into created_ticket;

  return created_ticket;
end;
$$;

alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.tickets enable row level security;

-- Public app: users can read published events.
drop policy if exists "published events are readable" on public.events;
create policy "published events are readable"
on public.events for select
using (is_published = true);

-- Clients can see tickets tied to their authenticated email.
drop policy if exists "clients read own tickets" on public.tickets;
create policy "clients read own tickets"
on public.tickets for select
using (
  lower(email) = lower(coalesce((select email from auth.users where id = auth.uid()), ''))
);

-- Admin and scanner policies should be tightened once Supabase Auth roles are wired.
-- For the first backend pass, use Edge Functions with service credentials for:
-- ticket creation after payment, admin event edits, scanner check-in, and email sending.
