-- Admin: campaigns and slots (phase 4b).
-- All admin mutations go through security definer functions that check
-- is_admin() and write one audit_log entry each. They are executable by
-- `authenticated` only (RLS-style check inside, since definer bypasses RLS).
--
-- Errors (SQLSTATE / message):
--   PB100 NOT_ADMIN
--   PB101 SLOT_HAS_BOOKINGS       slot can not be deleted (any booking, incl. cancelled)
--   PB102 CAPACITY_BELOW_BOOKED   capacity lower than confirmed bookings
--   PB103 INVALID_INPUT
--   PB104 SLUG_TAKEN
--   PB105 NOT_FOUND

------------------------------------------------------------------------------
-- audit_log: any entity, more actions
------------------------------------------------------------------------------
alter table public.audit_log
  add column entity_type text check (entity_type in ('booking', 'campaign', 'slot', 'export')),
  add column entity_id uuid;

update public.audit_log set entity_type = 'booking', entity_id = booking_id where booking_id is not null;

alter table public.audit_log drop constraint audit_log_action_check;
alter table public.audit_log add constraint audit_log_action_check check (action in (
  'create', 'update', 'cancel', 'admin_cancel',
  'booking_move',
  'campaign_create', 'campaign_update',
  'slots_generate', 'slot_update', 'slot_delete',
  'export'
));

create index audit_log_entity on public.audit_log (entity_type, entity_id);

-- Entries written with only booking_id (book_slot, cancel_booking_by_token)
-- get entity_type/entity_id filled in.
create function public.audit_log_fill_entity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.entity_type is null and new.booking_id is not null then
    new.entity_type := 'booking';
    new.entity_id := new.booking_id;
  end if;
  return new;
end;
$$;

create trigger audit_log_fill_entity
  before insert on public.audit_log
  for each row execute function public.audit_log_fill_entity();

------------------------------------------------------------------------------
-- Helpers
------------------------------------------------------------------------------
create function public.assert_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception using errcode = 'PB100', message = 'NOT_ADMIN';
  end if;
end;
$$;

create function public.admin_actor()
returns text
language sql
stable
set search_path = ''
as $$
  select 'admin:' || auth.uid()::text;
$$;

------------------------------------------------------------------------------
-- Campaigns
------------------------------------------------------------------------------
-- Creates (p_id null) or updates a campaign. Returns its id.
create function public.admin_save_campaign(
  p_id uuid,
  p_slug text,
  p_title text,
  p_location_address text,
  p_location_note text,
  p_is_active boolean,
  p_booking_closes_hours_before int,
  p_allow_public_cancel boolean,
  p_cancel_closes_hours_before int
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_old public.campaigns%rowtype;
  v_new public.campaigns%rowtype;
begin
  perform public.assert_admin();

  begin
    if p_id is null then
      insert into public.campaigns (
        slug, title, location_address, location_note, is_active,
        booking_closes_hours_before, allow_public_cancel, cancel_closes_hours_before
      )
      values (
        lower(btrim(p_slug)), btrim(p_title), btrim(p_location_address),
        nullif(btrim(p_location_note), ''), p_is_active,
        p_booking_closes_hours_before, p_allow_public_cancel, p_cancel_closes_hours_before
      )
      returning * into v_new;

      insert into public.audit_log (action, actor, entity_type, entity_id, payload)
      values ('campaign_create', public.admin_actor(), 'campaign', v_new.id, to_jsonb(v_new));
    else
      select * into v_old from public.campaigns where id = p_id for update;
      if not found then
        raise exception using errcode = 'PB105', message = 'NOT_FOUND';
      end if;

      update public.campaigns set
        slug = lower(btrim(p_slug)),
        title = btrim(p_title),
        location_address = btrim(p_location_address),
        location_note = nullif(btrim(p_location_note), ''),
        is_active = p_is_active,
        booking_closes_hours_before = p_booking_closes_hours_before,
        allow_public_cancel = p_allow_public_cancel,
        cancel_closes_hours_before = p_cancel_closes_hours_before
      where id = p_id
      returning * into v_new;

      insert into public.audit_log (action, actor, entity_type, entity_id, payload)
      values ('campaign_update', public.admin_actor(), 'campaign', p_id,
              jsonb_build_object('before', to_jsonb(v_old), 'after', to_jsonb(v_new)));
    end if;
  exception
    when unique_violation then
      raise exception using errcode = 'PB104', message = 'SLUG_TAKEN';
    when check_violation then
      raise exception using errcode = 'PB103', message = 'INVALID_INPUT';
  end;

  return v_new.id;
end;
$$;

------------------------------------------------------------------------------
-- Slot generator
------------------------------------------------------------------------------
-- Slot start times: for every date, from p_start every p_duration_min minutes;
-- the last slot must END by p_end. Local times are Europe/Sofia (DST is
-- handled by Postgres).
create function public.slot_times(p_dates date[], p_start time, p_end time, p_duration_min int)
returns setof timestamptz
language sql
stable
set search_path = ''
as $$
  select (d + p_start + make_interval(mins => n * p_duration_min)) at time zone 'Europe/Sofia'
  from unnest(p_dates) as d
  cross join generate_series(
    0,
    (floor(extract(epoch from (p_end - p_start)) / 60 / p_duration_min) - 1)::int
  ) as n;
$$;

-- status: 'new' (created, or would be created in a dry run), 'exists' (skipped),
-- 'past' (skipped). With p_dry_run nothing is written (used for the preview).
create function public.admin_generate_slots(
  p_campaign_id uuid,
  p_dates date[],
  p_start time,
  p_end time,
  p_duration_min int,
  p_capacity int,
  p_dry_run boolean
)
returns table (starts_at timestamptz, status text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_created timestamptz[] := '{}';
begin
  perform public.assert_admin();

  if p_dates is null or cardinality(p_dates) = 0 or cardinality(p_dates) > 366
     or p_start is null or p_end is null or p_end <= p_start
     or p_duration_min is null or p_duration_min not between 5 and 480
     or p_capacity is null or p_capacity not between 1 and 100
     or p_dry_run is null
  then
    raise exception using errcode = 'PB103', message = 'INVALID_INPUT';
  end if;

  if not exists (select 1 from public.campaigns where id = p_campaign_id) then
    raise exception using errcode = 'PB105', message = 'NOT_FOUND';
  end if;

  if not p_dry_run then
    with inserted as (
      insert into public.slots (campaign_id, starts_at, duration_min, capacity)
      select p_campaign_id, t, p_duration_min, p_capacity
      from public.slot_times(p_dates, p_start, p_end, p_duration_min) as t
      where t > now()
      on conflict on constraint slots_campaign_id_starts_at_key do nothing
      returning slots.starts_at
    )
    select coalesce(array_agg(inserted.starts_at), '{}') into v_created from inserted;

    insert into public.audit_log (action, actor, entity_type, entity_id, payload)
    values ('slots_generate', public.admin_actor(), 'campaign', p_campaign_id,
            jsonb_build_object(
              'dates', to_jsonb(p_dates), 'start', p_start, 'end', p_end,
              'duration_min', p_duration_min, 'capacity', p_capacity,
              'created', cardinality(v_created)));
  end if;

  return query
  select
    t,
    case
      when t <= now() then 'past'
      when t = any(v_created) then 'new'
      when exists (select 1 from public.slots s where s.campaign_id = p_campaign_id and s.starts_at = t)
        then 'exists'
      else 'new'
    end
  from public.slot_times(p_dates, p_start, p_end, p_duration_min) as t
  order by t;
end;
$$;

------------------------------------------------------------------------------
-- Single slot changes
------------------------------------------------------------------------------
create function public.admin_update_slot(p_slot_id uuid, p_is_blocked boolean, p_capacity int)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_old public.slots%rowtype;
  v_confirmed int;
begin
  perform public.assert_admin();

  if p_capacity is null or p_capacity not between 1 and 100 or p_is_blocked is null then
    raise exception using errcode = 'PB103', message = 'INVALID_INPUT';
  end if;

  -- Same lock as book_slot, so capacity can not race with a booking.
  select * into v_old from public.slots where id = p_slot_id for update;
  if not found then
    raise exception using errcode = 'PB105', message = 'NOT_FOUND';
  end if;

  select count(*)::int into v_confirmed
  from public.bookings b
  where b.slot_id = p_slot_id and b.status = 'confirmed';

  if p_capacity < v_confirmed then
    raise exception using errcode = 'PB102', message = 'CAPACITY_BELOW_BOOKED';
  end if;

  update public.slots set is_blocked = p_is_blocked, capacity = p_capacity where id = p_slot_id;

  insert into public.audit_log (action, actor, entity_type, entity_id, payload)
  values ('slot_update', public.admin_actor(), 'slot', p_slot_id,
          jsonb_build_object(
            'before', jsonb_build_object('is_blocked', v_old.is_blocked, 'capacity', v_old.capacity),
            'after', jsonb_build_object('is_blocked', p_is_blocked, 'capacity', p_capacity)));
end;
$$;

create function public.admin_delete_slot(p_slot_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_slot public.slots%rowtype;
begin
  perform public.assert_admin();

  select * into v_slot from public.slots where id = p_slot_id for update;
  if not found then
    raise exception using errcode = 'PB105', message = 'NOT_FOUND';
  end if;

  if exists (select 1 from public.bookings where slot_id = p_slot_id) then
    raise exception using errcode = 'PB101', message = 'SLOT_HAS_BOOKINGS';
  end if;

  delete from public.slots where id = p_slot_id;

  insert into public.audit_log (action, actor, entity_type, entity_id, payload)
  values ('slot_delete', public.admin_actor(), 'slot', p_slot_id, to_jsonb(v_slot));
end;
$$;

------------------------------------------------------------------------------
-- Read models for the admin UI (security_invoker: RLS of the caller applies)
------------------------------------------------------------------------------
create view public.admin_campaign_stats
with (security_invoker = true)
as
select
  c.*,
  (select count(*) from public.slots s where s.campaign_id = c.id and s.starts_at > now())::int
    as upcoming_slots,
  (select count(*) from public.bookings b
    join public.slots s on s.id = b.slot_id
    where b.campaign_id = c.id and b.status = 'confirmed' and s.starts_at > now())::int
    as upcoming_bookings
from public.campaigns c;

create view public.admin_slot_stats
with (security_invoker = true)
as
select
  s.*,
  (select count(*) from public.bookings b where b.slot_id = s.id and b.status = 'confirmed')::int
    as confirmed_count,
  (select count(*) from public.bookings b where b.slot_id = s.id)::int
    as total_bookings
from public.slots s;

------------------------------------------------------------------------------
-- Privileges
------------------------------------------------------------------------------
revoke all on public.admin_campaign_stats, public.admin_slot_stats from anon, authenticated;
grant select on public.admin_campaign_stats, public.admin_slot_stats to authenticated;

revoke execute on function public.assert_admin() from public, anon, authenticated;
revoke execute on function public.audit_log_fill_entity() from public, anon, authenticated;
revoke execute on function public.admin_actor() from public, anon, authenticated;
revoke execute on function public.slot_times(date[], time, time, int) from public, anon, authenticated;
revoke execute on function public.admin_save_campaign(uuid, text, text, text, text, boolean, int, boolean, int) from public, anon, authenticated;
revoke execute on function public.admin_generate_slots(uuid, date[], time, time, int, int, boolean) from public, anon, authenticated;
revoke execute on function public.admin_update_slot(uuid, boolean, int) from public, anon, authenticated;
revoke execute on function public.admin_delete_slot(uuid) from public, anon, authenticated;

grant execute on function public.admin_save_campaign(uuid, text, text, text, text, boolean, int, boolean, int) to authenticated;
grant execute on function public.admin_generate_slots(uuid, date[], time, time, int, int, boolean) to authenticated;
grant execute on function public.admin_update_slot(uuid, boolean, int) to authenticated;
grant execute on function public.admin_delete_slot(uuid) to authenticated;
