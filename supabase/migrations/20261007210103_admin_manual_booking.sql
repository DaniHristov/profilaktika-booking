-- Manual booking by an admin (phase 4e), e.g. after a phone call.
-- Same row lock and capacity rules as book_slot; no Turnstile/rate limit.
-- The source and the admin who entered it are kept. Email is optional for
-- admin bookings only.

alter table public.bookings
  add column source text not null default 'public' check (source in ('public', 'admin')),
  add column created_by uuid references auth.users (id) on delete set null,
  alter column email drop not null,
  add constraint bookings_email_required_for_public check (email is not null or source = 'admin'),
  add constraint bookings_created_by_only_admin check (source = 'admin' or created_by is null);

-- Admins may book after the public booking deadline and in an inactive
-- campaign (same as moving), but never into a blocked or past slot.
create function public.admin_book_slot(
  p_slot_id uuid,
  p_full_name text,
  p_phone text,
  p_email text,
  p_workplace text,
  p_notes text
)
returns table (booking_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_slot public.slots%rowtype;
  v_confirmed int;
  v_booking_id uuid;
  v_constraint text;
begin
  perform public.assert_admin();

  select * into v_slot from public.slots s where s.id = p_slot_id for update;
  if not found then
    raise exception using errcode = 'PB105', message = 'NOT_FOUND';
  end if;
  if v_slot.is_blocked or v_slot.starts_at <= now() then
    raise exception using errcode = 'PB003', message = 'CLOSED';
  end if;

  select count(*)::int into v_confirmed
  from public.bookings b
  where b.slot_id = p_slot_id and b.status = 'confirmed';
  if v_confirmed >= v_slot.capacity then
    raise exception using errcode = 'PB001', message = 'SLOT_FULL';
  end if;

  begin
    insert into public.bookings (
      campaign_id, slot_id, full_name, phone, email, workplace, notes,
      consent_at, source, created_by
    )
    values (
      v_slot.campaign_id,
      p_slot_id,
      regexp_replace(btrim(p_full_name), '\s+', ' ', 'g'),
      btrim(p_phone),
      nullif(lower(btrim(p_email)), ''),
      nullif(btrim(p_workplace), ''),
      nullif(btrim(p_notes), ''),
      -- Oral consent, confirmed by the admin in the form.
      now(),
      'admin',
      auth.uid()
    )
    returning id into v_booking_id;
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
  values (v_booking_id, 'create', public.admin_actor(), 'booking', v_booking_id,
          jsonb_build_object('slot_id', p_slot_id, 'source', 'admin', 'consent', 'oral'));

  return query select v_booking_id;
end;
$$;

-- Editing an admin booking may clear its (optional) email.
create or replace function public.admin_update_booking(
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
      -- An empty email is only accepted for admin bookings (check constraint).
      email = nullif(lower(btrim(p_email)), ''),
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

revoke execute on function public.admin_book_slot(uuid, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.admin_book_slot(uuid, text, text, text, text, text) to authenticated;
