-- Cancellation by token: rules, privileges, audit and freed capacity.
begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(24);

------------------------------------------------------------------------------
-- Fixtures
------------------------------------------------------------------------------
insert into public.campaigns (id, slug, title, location_address, allow_public_cancel, cancel_closes_hours_before)
values
  ('50000000-0000-0000-0000-000000000001', 'cx-open', 'Отворена', 'Адрес 1', true, 0),
  ('50000000-0000-0000-0000-000000000002', 'cx-disabled', 'Без отмяна', 'Адрес 2', false, 0),
  ('50000000-0000-0000-0000-000000000003', 'cx-deadline', 'Срок 24ч', 'Адрес 3', true, 24);

insert into public.slots (id, campaign_id, starts_at, duration_min, capacity)
values
  ('60000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', now() + interval '3 days', 30, 1),
  ('60000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000001', now() + interval '10 minutes', 30, 1),
  ('60000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000001', now() - interval '1 hour', 30, 1),
  ('60000000-0000-0000-0000-000000000004', '50000000-0000-0000-0000-000000000002', now() + interval '3 days', 30, 1),
  ('60000000-0000-0000-0000-000000000005', '50000000-0000-0000-0000-000000000003', now() + interval '12 hours', 30, 1),
  ('60000000-0000-0000-0000-000000000006', '50000000-0000-0000-0000-000000000003', now() + interval '3 days', 30, 1);

-- Inserted directly (book_slot would refuse the near/past slots).
insert into public.bookings (id, campaign_id, slot_id, full_name, phone, email, consent_at, cancel_token)
values
  ('70000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001',
   'Иван Иванов', '+359888000001', 'ivan@test.invalid', now(), 'a0000000-0000-0000-0000-000000000001'),
  ('70000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000002',
   'Скоро Започва', '+359888000002', 'soon@test.invalid', now(), 'a0000000-0000-0000-0000-000000000002'),
  ('70000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000003',
   'Минал Час', '+359888000003', 'past@test.invalid', now(), 'a0000000-0000-0000-0000-000000000003'),
  ('70000000-0000-0000-0000-000000000004', '50000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000004',
   'Без Отмяна', '+359888000004', 'disabled@test.invalid', now(), 'a0000000-0000-0000-0000-000000000004'),
  ('70000000-0000-0000-0000-000000000005', '50000000-0000-0000-0000-000000000003', '60000000-0000-0000-0000-000000000005',
   'След Срока', '+359888000005', 'late@test.invalid', now(), 'a0000000-0000-0000-0000-000000000005'),
  ('70000000-0000-0000-0000-000000000006', '50000000-0000-0000-0000-000000000003', '60000000-0000-0000-0000-000000000006',
   'Преди Срока', '+359888000006', 'early@test.invalid', now(), 'a0000000-0000-0000-0000-000000000006');

------------------------------------------------------------------------------
-- Privileges and defaults
------------------------------------------------------------------------------
select ok(not has_function_privilege('anon', 'public.get_booking_for_cancel(uuid)', 'EXECUTE'),
  'anon cannot execute get_booking_for_cancel');
select ok(not has_function_privilege('authenticated', 'public.get_booking_for_cancel(uuid)', 'EXECUTE'),
  'authenticated cannot execute get_booking_for_cancel');
select ok(has_function_privilege('service_role', 'public.get_booking_for_cancel(uuid)', 'EXECUTE'),
  'service_role can execute get_booking_for_cancel');
select ok(not has_function_privilege('anon', 'public.cancel_booking_by_token(uuid)', 'EXECUTE'),
  'anon cannot execute cancel_booking_by_token');
select ok(not has_function_privilege('authenticated', 'public.cancel_booking_by_token(uuid)', 'EXECUTE'),
  'authenticated cannot execute cancel_booking_by_token');
select ok(has_function_privilege('service_role', 'public.cancel_booking_by_token(uuid)', 'EXECUTE'),
  'service_role can execute cancel_booking_by_token');

select col_default_is('public', 'campaigns', 'allow_public_cancel', 'true', 'online cancellation is on by default');
select col_default_is('public', 'campaigns', 'cancel_closes_hours_before', '0', 'cancellation closes at the start by default');

------------------------------------------------------------------------------
-- get_booking_for_cancel
------------------------------------------------------------------------------
select is(
  pg_get_function_result('public.get_booking_for_cancel(uuid)'::regprocedure),
  'TABLE(full_name text, starts_at timestamp with time zone, duration_min integer, campaign_title text, location_address text, location_note text, cancel_state text)',
  'get_booking_for_cancel returns no phone or email'
);

select results_eq(
  $$ select t.token, (select cancel_state from public.get_booking_for_cancel(t.token))
     from (values
       ('a0000000-0000-0000-0000-000000000001'::uuid),
       ('a0000000-0000-0000-0000-000000000002'::uuid),
       ('a0000000-0000-0000-0000-000000000003'::uuid),
       ('a0000000-0000-0000-0000-000000000004'::uuid),
       ('a0000000-0000-0000-0000-000000000005'::uuid),
       ('a0000000-0000-0000-0000-000000000006'::uuid)
     ) as t(token) $$,
  $$ values
       ('a0000000-0000-0000-0000-000000000001'::uuid, 'allowed'),
       ('a0000000-0000-0000-0000-000000000002'::uuid, 'allowed'),
       ('a0000000-0000-0000-0000-000000000003'::uuid, 'closed'),
       ('a0000000-0000-0000-0000-000000000004'::uuid, 'disabled'),
       ('a0000000-0000-0000-0000-000000000005'::uuid, 'closed'),
       ('a0000000-0000-0000-0000-000000000006'::uuid, 'allowed') $$,
  'cancel_state: allowed until the start (default), closed after it, disabled by flag, per-campaign deadline'
);

select is_empty(
  $$ select * from public.get_booking_for_cancel('ffffffff-0000-0000-0000-000000000000') $$,
  'unknown token returns nothing'
);

------------------------------------------------------------------------------
-- cancel_booking_by_token
------------------------------------------------------------------------------
select throws_ok(
  $$ select * from public.cancel_booking_by_token('ffffffff-0000-0000-0000-000000000000') $$,
  'PB004', 'NOT_FOUND', 'unknown token raises NOT_FOUND'
);
select throws_ok(
  $$ select * from public.cancel_booking_by_token('a0000000-0000-0000-0000-000000000004') $$,
  'PB006', 'CANCEL_DISABLED', 'flag off raises CANCEL_DISABLED'
);
select throws_ok(
  $$ select * from public.cancel_booking_by_token('a0000000-0000-0000-0000-000000000003') $$,
  'PB007', 'CANCEL_CLOSED', 'started slot raises CANCEL_CLOSED'
);
select throws_ok(
  $$ select * from public.cancel_booking_by_token('a0000000-0000-0000-0000-000000000005') $$,
  'PB007', 'CANCEL_CLOSED', 'inside the campaign cancel deadline raises CANCEL_CLOSED'
);

select lives_ok(
  $$ select * from public.cancel_booking_by_token('a0000000-0000-0000-0000-000000000002') $$,
  'can cancel 10 minutes before the start with the default deadline'
);

set local role service_role;
create temp table cancelled on commit drop as
select * from public.cancel_booking_by_token('a0000000-0000-0000-0000-000000000001');
reset role;

select results_eq(
  $$ select booking_id, email, campaign_title from cancelled $$,
  $$ values ('70000000-0000-0000-0000-000000000001'::uuid, 'ivan@test.invalid'::text, 'Отворена'::text) $$,
  'returns the data needed for the cancellation email'
);

select is(
  (select status from public.bookings where id = '70000000-0000-0000-0000-000000000001'),
  'cancelled', 'status becomes cancelled'
);

select results_eq(
  $$ select action, actor, payload from public.audit_log where booking_id = '70000000-0000-0000-0000-000000000001' $$,
  $$ values ('cancel'::text, 'public'::text, '{"slot_id": "60000000-0000-0000-0000-000000000001"}'::jsonb) $$,
  'writes a cancel audit entry without personal data'
);

select throws_ok(
  $$ select * from public.cancel_booking_by_token('a0000000-0000-0000-0000-000000000001') $$,
  'PB005', 'ALREADY_CANCELLED', 'second cancellation raises ALREADY_CANCELLED'
);

select is(
  (select cancel_state from public.get_booking_for_cancel('a0000000-0000-0000-0000-000000000001')),
  'cancelled', 'cancel_state shows cancelled'
);

select is(
  (select available_count from public.get_availability('cx-open') where slot_id = '60000000-0000-0000-0000-000000000001'),
  1, 'the slot is free again'
);

select lives_ok(
  $$ select * from public.book_slot('60000000-0000-0000-0000-000000000001', 'Иван Иванов', '+359888000001', 'ivan@test.invalid', null, null) $$,
  'the same person can book again after cancelling'
);

select is(
  (select confirmation_sent_at from public.bookings where id = '70000000-0000-0000-0000-000000000006'),
  null, 'confirmation_sent_at starts empty'
);

select * from finish();
rollback;
