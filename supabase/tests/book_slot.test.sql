-- book_slot and check_rate_limit: business rules and privileges.
-- Concurrency (parallel requests) is covered by tests/integration.
begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(27);

------------------------------------------------------------------------------
-- Fixtures
------------------------------------------------------------------------------
insert into public.campaigns (id, slug, title, location_address, location_note, is_active, booking_closes_hours_before)
values
  ('30000000-0000-0000-0000-000000000001', 'bs-active', 'Кампания', 'Адрес 1', 'Етаж 2', true, 2),
  ('30000000-0000-0000-0000-000000000002', 'bs-inactive', 'Неактивна', 'Адрес 2', null, false, 2);

insert into public.slots (id, campaign_id, starts_at, duration_min, capacity, is_blocked)
values
  ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', now() + interval '3 days', 30, 1, false),
  ('40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', now() + interval '3 days 30 minutes', 30, 2, false),
  ('40000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001', now() + interval '3 days 1 hour', 30, 1, true),
  ('40000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000001', now() + interval '1 hour', 30, 1, false),
  ('40000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000001', now() - interval '1 day', 30, 1, false),
  ('40000000-0000-0000-0000-000000000006', '30000000-0000-0000-0000-000000000002', now() + interval '3 days', 30, 1, false),
  ('40000000-0000-0000-0000-000000000007', '30000000-0000-0000-0000-000000000001', now() + interval '4 days', 30, 1, false);

------------------------------------------------------------------------------
-- Privileges
------------------------------------------------------------------------------
select ok(not has_function_privilege('anon', 'public.book_slot(uuid, text, text, text, text, text)', 'EXECUTE'),
  'anon cannot execute book_slot');
select ok(not has_function_privilege('authenticated', 'public.book_slot(uuid, text, text, text, text, text)', 'EXECUTE'),
  'authenticated cannot execute book_slot');
select ok(has_function_privilege('service_role', 'public.book_slot(uuid, text, text, text, text, text)', 'EXECUTE'),
  'service_role can execute book_slot');
select ok(not has_function_privilege('anon', 'public.check_rate_limit(text, text, int, interval, boolean)', 'EXECUTE'),
  'anon cannot execute check_rate_limit');
select ok(not has_function_privilege('authenticated', 'public.check_rate_limit(text, text, int, interval, boolean)', 'EXECUTE'),
  'authenticated cannot execute check_rate_limit');
select ok(has_function_privilege('service_role', 'public.check_rate_limit(text, text, int, interval, boolean)', 'EXECUTE'),
  'service_role can execute check_rate_limit');
select ok(not has_table_privilege('service_role', 'public.rate_limit_hits', 'SELECT'),
  'nobody reads rate_limit_hits directly, not even service_role');

------------------------------------------------------------------------------
-- Successful booking (as service_role, like the server)
------------------------------------------------------------------------------
set local role service_role;

create temp table first_booking on commit drop as
select * from public.book_slot(
  '40000000-0000-0000-0000-000000000001',
  '  Иван    Иванов ', '+359888123456', '  Ivan@Example.COM ', '  ', '  Бележка  '
);

select is((select count(*)::int from first_booking), 1, 'book_slot returns one row');
select is((select campaign_title from first_booking), 'Кампания', 'returns the campaign title');
select is((select location_note from first_booking), 'Етаж 2', 'returns the location note');

reset role;

select results_eq(
  $$ select full_name, email, workplace, notes, status
     from public.bookings where id = (select booking_id from first_booking) $$,
  $$ values ('Иван Иванов'::text, 'ivan@example.com'::text, null::text, 'Бележка'::text, 'confirmed'::text) $$,
  'stores normalized name, email, empty workplace as null and trimmed notes'
);

select isnt((select consent_at from public.bookings where id = (select booking_id from first_booking)), null,
  'consent_at is set');

select results_eq(
  $$ select action, actor, payload from public.audit_log where booking_id = (select booking_id from first_booking) $$,
  $$ values ('create'::text, 'public'::text, '{"slot_id": "40000000-0000-0000-0000-000000000001"}'::jsonb) $$,
  'writes a create audit entry without personal data'
);

------------------------------------------------------------------------------
-- Errors
------------------------------------------------------------------------------
select throws_ok(
  $$ select * from public.book_slot('40000000-0000-0000-0000-000000000001', 'Мария Петрова', '+359888000001', 'maria@example.com', null, null) $$,
  'PB001', 'SLOT_FULL', 'full slot raises SLOT_FULL'
);

select throws_ok(
  $$ select * from public.book_slot('40000000-0000-0000-0000-000000000002', 'Иван Иванов', '+359888123456', 'IVAN@example.com', null, null) $$,
  'PB002', 'DUPLICATE_EMAIL', 'same email (any case) in the same campaign raises DUPLICATE_EMAIL'
);

select throws_ok(
  $$ select * from public.book_slot('40000000-0000-0000-0000-000000000003', 'X Y', '+359888000002', 'x1@example.com', null, null) $$,
  'PB003', 'CLOSED', 'blocked slot raises CLOSED'
);

select throws_ok(
  $$ select * from public.book_slot('40000000-0000-0000-0000-000000000004', 'X Y', '+359888000002', 'x2@example.com', null, null) $$,
  'PB003', 'CLOSED', 'slot inside booking_closes_hours_before raises CLOSED'
);

select throws_ok(
  $$ select * from public.book_slot('40000000-0000-0000-0000-000000000005', 'X Y', '+359888000002', 'x3@example.com', null, null) $$,
  'PB003', 'CLOSED', 'past slot raises CLOSED'
);

select throws_ok(
  $$ select * from public.book_slot('40000000-0000-0000-0000-000000000006', 'X Y', '+359888000002', 'x4@example.com', null, null) $$,
  'PB003', 'CLOSED', 'slot of an inactive campaign raises CLOSED'
);

select throws_ok(
  $$ select * from public.book_slot('49999999-0000-0000-0000-000000000000', 'X Y', '+359888000002', 'x5@example.com', null, null) $$,
  'PB003', 'CLOSED', 'unknown slot raises CLOSED'
);

select throws_ok(
  $$ select * from public.book_slot('40000000-0000-0000-0000-000000000002', 'X Y', '0888123456', 'x6@example.com', null, null) $$,
  '23514', null, 'non-E.164 phone is rejected by the check constraint'
);

------------------------------------------------------------------------------
-- Cancellation frees capacity and the email
------------------------------------------------------------------------------
update public.bookings set status = 'cancelled' where id = (select booking_id from first_booking);

select lives_ok(
  $$ select * from public.book_slot('40000000-0000-0000-0000-000000000001', 'Мария Петрова', '+359888000001', 'maria@example.com', null, null) $$,
  'a cancelled booking frees the slot'
);

select lives_ok(
  $$ select * from public.book_slot('40000000-0000-0000-0000-000000000007', 'Иван Иванов', '+359888123456', 'ivan@example.com', null, null) $$,
  'a cancelled booking frees the email for a new booking'
);

------------------------------------------------------------------------------
-- check_rate_limit
------------------------------------------------------------------------------
select is(
  (select array_agg(public.check_rate_limit(repeat('a', 64), 'booking_attempt', 2, interval '10 minutes'))
   from generate_series(1, 3)),
  array[true, true, false],
  'recording: allows up to the limit, then refuses'
);

select is(
  public.check_rate_limit(repeat('b', 64), 'booking_attempt', 2, interval '10 minutes'),
  true,
  'limits are per IP hash'
);

select is(
  (select array[
     public.check_rate_limit(repeat('c', 64), 'booking_success', 1, interval '1 hour', false),
     public.check_rate_limit(repeat('c', 64), 'booking_success', 1, interval '1 hour', true),
     public.check_rate_limit(repeat('c', 64), 'booking_success', 1, interval '1 hour', false)
   ]),
  array[true, true, false],
  'check-only mode does not count and refuses once the limit is reached'
);

select is(
  (select count(*)::int from public.rate_limit_hits where ip_hash = repeat('c', 64)),
  1,
  'check-only calls do not insert rows'
);

select * from finish();
rollback;
