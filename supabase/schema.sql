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

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  full_name text not null,
  email text not null unique,
  phone text,
  role public.user_role not null default 'client',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  event_date date not null,
  event_time time not null,
  city text not null,
  venue text not null,
  capacity integer not null check (capacity > 0),
  price_cents integer not null default 0 check (price_cents >= 0),
  image_path text not null default 'calima-event-cover.svg',
  description text not null,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  public_code text not null unique default upper('TCK-' || encode(gen_random_bytes(5), 'hex')),
  event_id uuid not null references public.events(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  first_name text not null,
  last_name text not null,
  birth_date date not null,
  email text not null,
  phone text not null,
  payment_status public.ticket_status not null default 'pending',
  checked_in boolean not null default false,
  checked_in_at timestamptz,
  checked_in_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

insert into
  storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'event-images',
    'event-images',
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

insert into public.events (
  name,
  event_date,
  event_time,
  city,
  venue,
  capacity,
  price_cents,
  image_path,
  description,
  is_published
)
select
  'Calima Opening Night',
  '2026-06-12',
  '22:30',
  'Tenerife',
  'Secret terrace',
  180,
  2500,
  '/calima-event-cover.svg',
  'Una serata calda, tribale e solare: musica, persone e vibrazioni ispirate al vento di Tenerife.',
  true
where not exists (select 1 from public.events);

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
  sold_count integer;
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

  select count(*)
  into sold_count
  from public.tickets
  where event_id = p_event_id and payment_status <> 'cancelled';

  if sold_count >= selected_event.capacity then
    raise exception 'EVENT_SOLD_OUT';
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
    case when selected_event.price_cents > 0 then 'pending'::public.ticket_status else 'paid'::public.ticket_status end
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
