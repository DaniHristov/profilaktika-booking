-- Public cancellation by token and confirmation email tracking.
-- Both functions are service_role only (called from the server; the token is
-- a secret from the confirmation email).
--
-- Errors raised by cancel_booking_by_token (SQLSTATE / message):
--   PB004 NOT_FOUND          unknown token
--   PB005 ALREADY_CANCELLED  booking is already cancelled
--   PB006 CANCEL_DISABLED    the campaign does not allow online cancellation
--   PB007 CANCEL_CLOSED      past starts_at - cancel_closes_hours_before

------------------------------------------------------------------------------
-- Columns
------------------------------------------------------------------------------
alter table public.campaigns
  -- Feature flag: the medical center can turn off online cancellation.
  add column allow_public_cancel boolean not null default true,
  -- Online cancellation is possible until starts_at minus this many hours.
  add column cancel_closes_hours_before int not null default 0
    check (cancel_closes_hours_before between 0 and 720);

-- Set when the confirmation email was accepted by the email provider.
-- NULL = not sent yet (retried by the phase 5 cron).
alter table public.bookings
  add column confirmation_sent_at timestamptz;

------------------------------------------------------------------------------
-- get_booking_for_cancel
------------------------------------------------------------------------------
-- cancel_state: 'allowed' | 'cancelled' | 'disabled' | 'closed'
create function public.get_booking_for_cancel(p_token uuid)
returns table (
  full_name text,
  starts_at timestamptz,
  duration_min int,
  campaign_title text,
  location_address text,
  location_note text,
  cancel_state text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    b.full_name,
    s.starts_at,
    s.duration_min,
    c.title,
    c.location_address,
    c.location_note,
    case
      when b.status = 'cancelled' then 'cancelled'
      when not c.allow_public_cancel then 'disabled'
      when now() >= s.starts_at - make_interval(hours => c.cancel_closes_hours_before) then 'closed'
      else 'allowed'
    end
  from public.bookings b
  join public.slots s on s.id = b.slot_id
  join public.campaigns c on c.id = b.campaign_id
  where b.cancel_token = p_token;
$$;

------------------------------------------------------------------------------
-- cancel_booking_by_token
------------------------------------------------------------------------------
create function public.cancel_booking_by_token(p_token uuid)
returns table (
  booking_id uuid,
  full_name text,
  email text,
  starts_at timestamptz,
  duration_min int,
  campaign_title text,
  location_address text,
  location_note text
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
  v_slot public.slots%rowtype;
  v_campaign public.campaigns%rowtype;
begin
  -- Serializes concurrent cancellations of the same booking.
  select * into v_booking
  from public.bookings b
  where b.cancel_token = p_token
  for update;

  if not found then
    raise exception using errcode = 'PB004', message = 'NOT_FOUND';
  end if;

  if v_booking.status = 'cancelled' then
    raise exception using errcode = 'PB005', message = 'ALREADY_CANCELLED';
  end if;

  select * into v_slot from public.slots s where s.id = v_booking.slot_id;
  select * into v_campaign from public.campaigns c where c.id = v_booking.campaign_id;

  if not v_campaign.allow_public_cancel then
    raise exception using errcode = 'PB006', message = 'CANCEL_DISABLED';
  end if;

  if now() >= v_slot.starts_at - make_interval(hours => v_campaign.cancel_closes_hours_before) then
    raise exception using errcode = 'PB007', message = 'CANCEL_CLOSED';
  end if;

  update public.bookings b
  set status = 'cancelled'
  where b.id = v_booking.id;

  insert into public.audit_log (booking_id, action, actor, payload)
  values (v_booking.id, 'cancel', 'public', jsonb_build_object('slot_id', v_booking.slot_id));

  return query
  select
    v_booking.id,
    v_booking.full_name,
    v_booking.email,
    v_slot.starts_at,
    v_slot.duration_min,
    v_campaign.title,
    v_campaign.location_address,
    v_campaign.location_note;
end;
$$;

------------------------------------------------------------------------------
-- Privileges
------------------------------------------------------------------------------
revoke execute on function public.get_booking_for_cancel(uuid) from public, anon, authenticated;
revoke execute on function public.cancel_booking_by_token(uuid) from public, anon, authenticated;
grant execute on function public.get_booking_for_cancel(uuid) to service_role;
grant execute on function public.cancel_booking_by_token(uuid) to service_role;
