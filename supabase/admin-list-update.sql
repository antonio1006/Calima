-- Run this once in Supabase SQL Editor before deploying the admin list workflow.

alter type public.ticket_status add value if not exists 'accepted';
alter type public.ticket_status add value if not exists 'rejected';

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
