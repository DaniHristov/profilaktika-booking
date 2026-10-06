-- book_slot: the only way to create a booking, and IP rate limiting for it.
-- Both functions are executable by service_role only: they are called from
-- the server after Zod validation and Turnstile, never directly by clients
-- (the anon key is public, so anything granted to anon is callable via
-- /rest/v1/rpc/... and would bypass those checks).
--
-- Errors raised by book_slot (SQLSTATE / message), mapped to Bulgarian
-- messages by the server:
--   PB001 SLOT_FULL        no capacity left in the slot
--   PB002 DUPLICATE_EMAIL  this email already has a confirmed booking in the campaign
--   PB003 CLOSED           unknown slot, inactive campaign, blocked slot,
--                          slot in the past or after the booking deadline

------------------------------------------------------------------------------
-- book_slot
------------------------------------------------------------------------------
create function public.book_slot(
  p_slot_id uuid,
  p_full_name text,
  p_phone text,
  p_email text,
  p_workplace text,
  p_notes text
)
returns table (
  booking_id uuid,
  cancel_token uuid,
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
  v_slot public.slots%rowtype;
  v_campaign public.campaigns%rowtype;
  v_confirmed int;
  v_booking public.bookings%rowtype;
  v_constraint text;
begin
  -- Serializes concurrent bookings for the same slot. Under READ COMMITTED
  -- every statement below sees rows committed by the previous lock holder.
  select * into v_slot
  from public.slots s
  where s.id = p_slot_id
  for update;

  if not found then
    raise exception using errcode = 'PB003', message = 'CLOSED';
  end if;

  select * into v_campaign
  from public.campaigns c
  where c.id = v_slot.campaign_id;

  if not v_campaign.is_active
     or v_slot.is_blocked
     or v_slot.starts_at <= now() + make_interval(hours => v_campaign.booking_closes_hours_before)
  then
    raise exception using errcode = 'PB003', message = 'CLOSED';
  end if;

  select count(*)::int into v_confirmed
  from public.bookings b
  where b.slot_id = p_slot_id
    and b.status = 'confirmed';

  if v_confirmed >= v_slot.capacity then
    raise exception using errcode = 'PB001', message = 'SLOT_FULL';
  end if;

  begin
    insert into public.bookings (
      campaign_id, slot_id, full_name, phone, email, workplace, notes, consent_at
    )
    values (
      v_slot.campaign_id,
      p_slot_id,
      -- Normalized again here so the database never depends on the caller.
      regexp_replace(btrim(p_full_name), '\s+', ' ', 'g'),
      btrim(p_phone),
      lower(btrim(p_email)),
      nullif(btrim(p_workplace), ''),
      nullif(btrim(p_notes), ''),
      now()
    )
    returning * into v_booking;
  exception
    when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'bookings_one_active_per_email' then
        raise exception using errcode = 'PB002', message = 'DUPLICATE_EMAIL';
      end if;
      raise;
  end;

  insert into public.audit_log (booking_id, action, actor, payload)
  values (v_booking.id, 'create', 'public', jsonb_build_object('slot_id', p_slot_id));

  return query
  select
    v_booking.id,
    v_booking.cancel_token,
    v_slot.starts_at,
    v_slot.duration_min,
    v_campaign.title,
    v_campaign.location_address,
    v_campaign.location_note;
end;
$$;

revoke execute on function public.book_slot(uuid, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.book_slot(uuid, text, text, text, text, text)
  to service_role;

------------------------------------------------------------------------------
-- Rate limiting
------------------------------------------------------------------------------
-- ip_hash is HMAC-SHA256(ip, IP_HASH_SECRET) computed on the server; raw IPs
-- are never stored. Rows older than 24 hours are deleted by check_rate_limit.
create table public.rate_limit_hits (
  id bigint generated always as identity primary key,
  ip_hash text not null check (ip_hash ~ '^[0-9a-f]{64}$'),
  kind text not null check (kind in ('booking_attempt', 'booking_success')),
  created_at timestamptz not null default now()
);

create index rate_limit_hits_lookup on public.rate_limit_hits (ip_hash, kind, created_at);
create index rate_limit_hits_created_at on public.rate_limit_hits (created_at);

alter table public.rate_limit_hits enable row level security;
-- No policies and no grants: only the security definer function below
-- touches this table.
revoke all on public.rate_limit_hits from anon, authenticated, service_role;
revoke all on sequence public.rate_limit_hits_id_seq from anon, authenticated, service_role;

-- Returns true when the caller is within the limit. With p_record = true the
-- current request is counted (before checking); with false it only checks.
create function public.check_rate_limit(
  p_ip_hash text,
  p_kind text,
  p_limit int,
  p_window interval,
  p_record boolean default true
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  -- One lock per IP hash keeps count + insert consistent under concurrency.
  perform pg_advisory_xact_lock(hashtextextended(p_ip_hash, 0));

  delete from public.rate_limit_hits
  where created_at < now() - interval '24 hours';

  if p_record then
    insert into public.rate_limit_hits (ip_hash, kind) values (p_ip_hash, p_kind);
  end if;

  select count(*)::int into v_count
  from public.rate_limit_hits h
  where h.ip_hash = p_ip_hash
    and h.kind = p_kind
    and h.created_at > now() - p_window;

  -- When recording, v_count includes the current request.
  return case when p_record then v_count <= p_limit else v_count < p_limit end;
end;
$$;

revoke execute on function public.check_rate_limit(text, text, int, interval, boolean)
  from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, text, int, interval, boolean)
  to service_role;
