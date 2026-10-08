-- Production jobs (phase 5): reminders, confirmation retries and GDPR
-- anonymization. All functions are service_role only (called by the cron
-- route handlers). Local dates are Europe/Sofia.

------------------------------------------------------------------------------
-- Columns and constraints
------------------------------------------------------------------------------
alter table public.bookings
  add column reminder_sent_at timestamptz,
  add column anonymized_at timestamptz;

-- Anonymized bookings have no email, whatever their source.
alter table public.bookings drop constraint bookings_email_required_for_public;
alter table public.bookings add constraint bookings_email_required_for_public
  check (email is not null or source = 'admin' or anonymized_at is not null);

alter table public.audit_log drop constraint audit_log_action_check;
alter table public.audit_log add constraint audit_log_action_check check (action in (
  'create', 'update', 'cancel', 'admin_cancel',
  'booking_move',
  'campaign_create', 'campaign_update',
  'slots_generate', 'slot_update', 'slot_delete',
  'export',
  'anonymize'
));

alter table public.audit_log drop constraint audit_log_entity_type_check;
alter table public.audit_log add constraint audit_log_entity_type_check
  check (entity_type in ('booking', 'campaign', 'slot', 'export', 'retention'));

------------------------------------------------------------------------------
-- Reminders: confirmed bookings with an email whose slot is tomorrow (Sofia)
------------------------------------------------------------------------------
create function public.bookings_due_for_reminder(p_limit int)
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
language sql
stable
security definer
set search_path = ''
as $$
  select b.id, b.full_name, b.email, b.cancel_token, s.starts_at, s.duration_min,
         c.title, c.location_address, c.location_note, c.allow_public_cancel
  from public.bookings b
  join public.slots s on s.id = b.slot_id
  join public.campaigns c on c.id = b.campaign_id
  where b.status = 'confirmed'
    and b.email is not null
    and b.reminder_sent_at is null
    and b.anonymized_at is null
    and (s.starts_at at time zone 'Europe/Sofia')::date
        = (now() at time zone 'Europe/Sofia')::date + 1
    and s.starts_at > now()
  order by s.starts_at
  limit greatest(least(coalesce(p_limit, 200), 1000), 1);
$$;

------------------------------------------------------------------------------
-- Confirmation retries: unsent confirmations of the last 72 hours with a
-- future slot. Bookings younger than 10 minutes are left to the sender that
-- runs right after the booking.
------------------------------------------------------------------------------
create function public.bookings_needing_confirmation(p_limit int)
returns table (booking_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select b.id
  from public.bookings b
  join public.slots s on s.id = b.slot_id
  where b.status = 'confirmed'
    and b.email is not null
    and b.confirmation_sent_at is null
    and b.anonymized_at is null
    and b.created_at between now() - interval '72 hours' and now() - interval '10 minutes'
    and s.starts_at > now()
  order by b.created_at
  limit greatest(least(coalesce(p_limit, 100), 1000), 1);
$$;

------------------------------------------------------------------------------
-- GDPR anonymization
------------------------------------------------------------------------------
-- Anonymizes bookings whose slot started more than p_months months ago
-- (confirmed and cancelled). Keeps the booking row (statistics), removes
-- personal data from it and from its audit entries. Returns the count.
create function public.anonymize_old_bookings(p_months int)
returns int
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_ids uuid[];
begin
  if p_months is null or p_months < 1 or p_months > 120 then
    raise exception using errcode = 'PB103', message = 'INVALID_INPUT';
  end if;

  select coalesce(array_agg(b.id), '{}') into v_ids
  from public.bookings b
  join public.slots s on s.id = b.slot_id
  where b.anonymized_at is null
    and s.starts_at < now() - make_interval(months => p_months);

  if cardinality(v_ids) = 0 then
    return 0;
  end if;

  update public.bookings b set
    full_name = 'Анонимизиран',
    phone = '+0000000',
    email = null,
    workplace = null,
    notes = null,
    -- Old cancel links stop working.
    cancel_token = gen_random_uuid(),
    anonymized_at = now()
  where b.id = any(v_ids);

  -- Personal data in audit entries lives in the before/after snapshots of
  -- admin edits; other booking payloads hold only ids.
  update public.audit_log a set
    payload = (coalesce(a.payload, '{}'::jsonb) - 'before' - 'after') || '{"anonymized": true}'::jsonb
  where a.booking_id = any(v_ids)
    and a.payload ?| array['before', 'after'];

  insert into public.audit_log (action, actor, entity_type, payload)
  values ('anonymize', 'system', 'retention',
          jsonb_build_object('count', cardinality(v_ids), 'months', p_months));

  return cardinality(v_ids);
end;
$$;

-- The retention job is not a public or admin actor.
alter table public.audit_log drop constraint audit_log_actor_check;
alter table public.audit_log add constraint audit_log_actor_check
  check (actor in ('public', 'system') or actor ~ '^admin:[0-9a-f-]{36}$');

------------------------------------------------------------------------------
-- Privileges
------------------------------------------------------------------------------
revoke execute on function public.bookings_due_for_reminder(int) from public, anon, authenticated;
revoke execute on function public.bookings_needing_confirmation(int) from public, anon, authenticated;
revoke execute on function public.anonymize_old_bookings(int) from public, anon, authenticated;
grant execute on function public.bookings_due_for_reminder(int) to service_role;
grant execute on function public.bookings_needing_confirmation(int) to service_role;
grant execute on function public.anonymize_old_bookings(int) to service_role;
