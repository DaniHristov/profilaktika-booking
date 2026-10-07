-- Admin: bookings list, edit, move and cancel (phase 4c).
--
-- New errors (SQLSTATE / message):
--   PB106 NOT_CONFIRMED   the booking is cancelled
-- Reused: PB001 SLOT_FULL, PB002 DUPLICATE_EMAIL, PB003 CLOSED, PB005
-- ALREADY_CANCELLED, PB100 NOT_ADMIN, PB103 INVALID_INPUT, PB105 NOT_FOUND.

------------------------------------------------------------------------------
-- List / search (security invoker: RLS limits it to admins)
------------------------------------------------------------------------------
-- p_status: 'confirmed' | 'cancelled' | 'all'. p_date / p_time are
-- Europe/Sofia local. p_search matches name, email and phone (digits only,
-- also in 0888... form). total_count is the number of rows before paging.
create function public.admin_list_bookings(
  p_campaign_id uuid,
  p_date date,
  p_time text,
  p_status text,
  p_search text,
  p_limit int,
  p_offset int
)
returns table (
  id uuid,
  campaign_id uuid,
  campaign_title text,
  slot_id uuid,
  starts_at timestamptz,
  duration_min int,
  full_name text,
  phone text,
  email text,
  workplace text,
  notes text,
  status text,
  created_at timestamptz,
  confirmation_sent_at timestamptz,
  total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with params as (
    select
      nullif(btrim(p_search), '') as q,
      nullif(regexp_replace(coalesce(p_search, ''), '\D', '', 'g'), '') as digits
  )
  select
    b.id, b.campaign_id, c.title, b.slot_id, s.starts_at, s.duration_min,
    b.full_name, b.phone, b.email, b.workplace, b.notes, b.status, b.created_at,
    b.confirmation_sent_at,
    count(*) over ()
  from public.bookings b
  join public.slots s on s.id = b.slot_id
  join public.campaigns c on c.id = b.campaign_id
  cross join params p
  where (p_campaign_id is null or b.campaign_id = p_campaign_id)
    and (p_date is null or (s.starts_at at time zone 'Europe/Sofia')::date = p_date)
    and (p_time is null or to_char(s.starts_at at time zone 'Europe/Sofia', 'HH24:MI') = p_time)
    and (coalesce(p_status, 'all') = 'all' or b.status = p_status)
    and (
      p.q is null
      or b.full_name ilike '%' || p.q || '%'
      or b.email ilike '%' || p.q || '%'
      or (length(p.digits) >= 3 and (
            regexp_replace(b.phone, '\D', '', 'g') like '%' || p.digits || '%'
            or regexp_replace(b.phone, '^\+359', '0') like '%' || p.digits || '%'
          ))
    )
  order by s.starts_at, b.created_at
  limit greatest(least(coalesce(p_limit, 50), 10000), 1)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

------------------------------------------------------------------------------
-- Edit contact data
------------------------------------------------------------------------------
create function public.admin_update_booking(
  p_booking_id uuid,
  p_full_name text,
  p_phone text,
  p_email text,
  p_workplace text,
  p_notes text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_old public.bookings%rowtype;
  v_new public.bookings%rowtype;
  v_constraint text;
begin
  perform public.assert_admin();

  select * into v_old from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception using errcode = 'PB105', message = 'NOT_FOUND';
  end if;

  begin
    update public.bookings set
      full_name = regexp_replace(btrim(p_full_name), '\s+', ' ', 'g'),
      phone = btrim(p_phone),
      email = lower(btrim(p_email)),
      workplace = nullif(btrim(p_workplace), ''),
      notes = nullif(btrim(p_notes), '')
    where id = p_booking_id
    returning * into v_new;
  exception
    when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'bookings_one_active_per_email' then
        raise exception using errcode = 'PB002', message = 'DUPLICATE_EMAIL';
      end if;
      raise;
    when check_violation or not_null_violation then
      raise exception using errcode = 'PB103', message = 'INVALID_INPUT';
  end;

  insert into public.audit_log (booking_id, action, actor, entity_type, entity_id, payload)
  values (p_booking_id, 'update', public.admin_actor(), 'booking', p_booking_id,
          jsonb_build_object(
            'before', jsonb_build_object('full_name', v_old.full_name, 'phone', v_old.phone,
              'email', v_old.email, 'workplace', v_old.workplace, 'notes', v_old.notes),
            'after', jsonb_build_object('full_name', v_new.full_name, 'phone', v_new.phone,
              'email', v_new.email, 'workplace', v_new.workplace, 'notes', v_new.notes)));
end;
$$;

------------------------------------------------------------------------------
-- Move to another slot (same locking rules as book_slot)
------------------------------------------------------------------------------
create function public.admin_move_booking(p_booking_id uuid, p_new_slot_id uuid)
returns table (
  booking_id uuid,
  full_name text,
  email text,
  cancel_token uuid,
  starts_at timestamptz,
  duration_min int,
  campaign_title text,
  location_address text,
  location_note text,
  allow_public_cancel boolean
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
  v_new_slot public.slots%rowtype;
  v_campaign public.campaigns%rowtype;
  v_confirmed int;
begin
  perform public.assert_admin();

  select * into v_booking from public.bookings b where b.id = p_booking_id for update;
  if not found then
    raise exception using errcode = 'PB105', message = 'NOT_FOUND';
  end if;
  if v_booking.status <> 'confirmed' then
    raise exception using errcode = 'PB106', message = 'NOT_CONFIRMED';
  end if;
  if v_booking.slot_id = p_new_slot_id then
    raise exception using errcode = 'PB103', message = 'INVALID_INPUT';
  end if;

  -- Lock both slots in id order, so two concurrent moves in opposite
  -- directions can not deadlock.
  perform 1 from public.slots s
  where s.id in (v_booking.slot_id, p_new_slot_id)
  order by s.id
  for update;

  select * into v_new_slot from public.slots s where s.id = p_new_slot_id;
  if not found or v_new_slot.campaign_id <> v_booking.campaign_id then
    raise exception using errcode = 'PB105', message = 'NOT_FOUND';
  end if;

  -- Admins may move after the public booking deadline, but not into a
  -- blocked or past slot.
  if v_new_slot.is_blocked or v_new_slot.starts_at <= now() then
    raise exception using errcode = 'PB003', message = 'CLOSED';
  end if;

  select count(*)::int into v_confirmed
  from public.bookings b
  where b.slot_id = p_new_slot_id and b.status = 'confirmed';
  if v_confirmed >= v_new_slot.capacity then
    raise exception using errcode = 'PB001', message = 'SLOT_FULL';
  end if;

  update public.bookings b set slot_id = p_new_slot_id where b.id = p_booking_id;

  insert into public.audit_log (booking_id, action, actor, entity_type, entity_id, payload)
  values (p_booking_id, 'booking_move', public.admin_actor(), 'booking', p_booking_id,
          jsonb_build_object('from_slot_id', v_booking.slot_id, 'to_slot_id', p_new_slot_id));

  select * into v_campaign from public.campaigns c where c.id = v_booking.campaign_id;

  return query select
    v_booking.id, v_booking.full_name, v_booking.email, v_booking.cancel_token,
    v_new_slot.starts_at, v_new_slot.duration_min,
    v_campaign.title, v_campaign.location_address, v_campaign.location_note,
    v_campaign.allow_public_cancel;
end;
$$;

------------------------------------------------------------------------------
-- Cancel (always allowed for admins; no flag or deadline)
------------------------------------------------------------------------------
create function public.admin_cancel_booking(p_booking_id uuid)
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
  perform public.assert_admin();

  select * into v_booking from public.bookings b where b.id = p_booking_id for update;
  if not found then
    raise exception using errcode = 'PB105', message = 'NOT_FOUND';
  end if;
  if v_booking.status = 'cancelled' then
    raise exception using errcode = 'PB005', message = 'ALREADY_CANCELLED';
  end if;

  update public.bookings b set status = 'cancelled' where b.id = p_booking_id;

  insert into public.audit_log (booking_id, action, actor, entity_type, entity_id, payload)
  values (p_booking_id, 'admin_cancel', public.admin_actor(), 'booking', p_booking_id,
          jsonb_build_object('slot_id', v_booking.slot_id));

  select * into v_slot from public.slots s where s.id = v_booking.slot_id;
  select * into v_campaign from public.campaigns c where c.id = v_booking.campaign_id;

  return query select
    v_booking.id, v_booking.full_name, v_booking.email, v_slot.starts_at, v_slot.duration_min,
    v_campaign.title, v_campaign.location_address, v_campaign.location_note;
end;
$$;

------------------------------------------------------------------------------
-- Privileges
------------------------------------------------------------------------------
revoke execute on function public.admin_list_bookings(uuid, date, text, text, text, int, int) from public, anon, authenticated;
revoke execute on function public.admin_update_booking(uuid, text, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.admin_move_booking(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.admin_cancel_booking(uuid) from public, anon, authenticated;

grant execute on function public.admin_list_bookings(uuid, date, text, text, text, int, int) to authenticated;
grant execute on function public.admin_update_booking(uuid, text, text, text, text, text) to authenticated;
grant execute on function public.admin_move_booking(uuid, uuid) to authenticated;
grant execute on function public.admin_cancel_booking(uuid) to authenticated;
