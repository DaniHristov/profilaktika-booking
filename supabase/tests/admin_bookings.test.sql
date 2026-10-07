-- Admin functions for bookings (phase 4c).
begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(25);

insert into auth.users (id, instance_id, aud, role, email)
values
  ('00000000-0000-0000-0000-00000000bc01', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a4c@test.invalid'),
  ('00000000-0000-0000-0000-00000000bc02', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'u4c@test.invalid');
insert into public.admins (user_id, email) values ('00000000-0000-0000-0000-00000000bc01', 'a4c@test.invalid');

create function pg_temp.as_user(p_id text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;

insert into public.campaigns (id, slug, title, location_address)
values ('c4c00000-0000-0000-0000-000000000001', 'bk-a', 'Кампания А', 'Адрес А'),
       ('c4c00000-0000-0000-0000-000000000002', 'bk-b', 'Кампания Б', 'Адрес Б');

-- Sofia 10:00 on a fixed future date for the date/time filter.
insert into public.slots (id, campaign_id, starts_at, duration_min, capacity, is_blocked)
values
  ('d4c00000-0000-0000-0000-000000000001', 'c4c00000-0000-0000-0000-000000000001', '2030-03-04 10:00 Europe/Sofia', 30, 2, false),
  ('d4c00000-0000-0000-0000-000000000002', 'c4c00000-0000-0000-0000-000000000001', '2030-03-04 10:30 Europe/Sofia', 30, 1, false),
  ('d4c00000-0000-0000-0000-000000000003', 'c4c00000-0000-0000-0000-000000000001', '2030-03-04 11:00 Europe/Sofia', 30, 1, true),
  ('d4c00000-0000-0000-0000-000000000004', 'c4c00000-0000-0000-0000-000000000001', now() - interval '1 day', 30, 1, false),
  ('d4c00000-0000-0000-0000-000000000005', 'c4c00000-0000-0000-0000-000000000002', '2030-03-04 10:00 Europe/Sofia', 30, 1, false),
  -- Inside the public booking deadline, still allowed for admins.
  ('d4c00000-0000-0000-0000-000000000006', 'c4c00000-0000-0000-0000-000000000001', now() + interval '30 minutes', 30, 1, false);

insert into public.bookings (id, campaign_id, slot_id, full_name, phone, email, consent_at)
values
  ('e4c00000-0000-0000-0000-000000000001', 'c4c00000-0000-0000-0000-000000000001', 'd4c00000-0000-0000-0000-000000000001', 'Иван Иванов', '+359888123456', 'ivan@test.invalid', now()),
  ('e4c00000-0000-0000-0000-000000000002', 'c4c00000-0000-0000-0000-000000000001', 'd4c00000-0000-0000-0000-000000000002', 'Мария Петрова', '+35929876543', 'maria@test.invalid', now()),
  ('e4c00000-0000-0000-0000-000000000003', 'c4c00000-0000-0000-0000-000000000002', 'd4c00000-0000-0000-0000-000000000005', 'Георги Георгиев', '+359877000111', 'georgi@test.invalid', now());

------------------------------------------------------------------------------
-- Non-admin
------------------------------------------------------------------------------
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000bc02');
select is_empty($$ select * from public.admin_list_bookings(null, null, null, 'all', null, 50, 0) $$,
  'non-admin lists nothing (RLS)');
select throws_ok($$ select public.admin_update_booking('e4c00000-0000-0000-0000-000000000001', 'X', '+359888000000', 'x@test.invalid', null, null) $$,
  'PB100', 'NOT_ADMIN', 'non-admin cannot edit');
select throws_ok($$ select * from public.admin_move_booking('e4c00000-0000-0000-0000-000000000001', 'd4c00000-0000-0000-0000-000000000002') $$,
  'PB100', 'NOT_ADMIN', 'non-admin cannot move');
select throws_ok($$ select * from public.admin_cancel_booking('e4c00000-0000-0000-0000-000000000001') $$,
  'PB100', 'NOT_ADMIN', 'non-admin cannot cancel');

------------------------------------------------------------------------------
-- Admin: list and search
------------------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-00000000bc01');

select is((select count(*)::int from public.admin_list_bookings('c4c00000-0000-0000-0000-000000000001', null, null, 'all', null, 50, 0)),
  2, 'filters by campaign');
select is((select count(*)::int from public.admin_list_bookings(null, '2030-03-04', '10:00', 'all', null, 50, 0)
           where campaign_id in ('c4c00000-0000-0000-0000-000000000001', 'c4c00000-0000-0000-0000-000000000002')),
  2, 'filters by Sofia date and time');
select is((select full_name from public.admin_list_bookings(null, null, null, 'all', 'петров', 50, 0)),
  'Мария Петрова', 'searches by name (case-insensitive)');
select is((select full_name from public.admin_list_bookings(null, null, null, 'all', 'GEORGI@', 50, 0)),
  'Георги Георгиев', 'searches by email');
select is((select full_name from public.admin_list_bookings(null, null, null, 'all', '0888 123', 50, 0)),
  'Иван Иванов', 'searches by phone in 0888 form');
select is((select full_name from public.admin_list_bookings(null, null, null, 'all', '29876543', 50, 0)),
  'Мария Петрова', 'searches by phone digits');
select results_eq(
  $$ select count(*)::int, max(total_count)::int from public.admin_list_bookings('c4c00000-0000-0000-0000-000000000001', null, null, 'all', null, 1, 0) $$,
  $$ values (1, 2) $$, 'paging returns the total count'
);

------------------------------------------------------------------------------
-- Edit
------------------------------------------------------------------------------
select lives_ok(
  $$ select public.admin_update_booking('e4c00000-0000-0000-0000-000000000001', ' Иван  Стоянов ', '+359888123457', ' IVAN2@test.invalid ', ' Фирма ', '') $$,
  'admin edits contact data'
);
select results_eq(
  $$ select full_name, phone, email, workplace, notes from public.bookings where id = 'e4c00000-0000-0000-0000-000000000001' $$,
  $$ values ('Иван Стоянов'::text, '+359888123457'::text, 'ivan2@test.invalid'::text, 'Фирма'::text, null::text) $$,
  'edit is normalized'
);
select throws_ok(
  $$ select public.admin_update_booking('e4c00000-0000-0000-0000-000000000001', 'Иван', '+359888123457', 'maria@test.invalid', null, null) $$,
  'PB002', 'DUPLICATE_EMAIL', 'email of another active booking in the campaign is refused'
);
select throws_ok(
  $$ select public.admin_update_booking('e4c00000-0000-0000-0000-000000000001', 'Иван', '0888', 'ivan2@test.invalid', null, null) $$,
  'PB103', 'INVALID_INPUT', 'invalid phone is refused'
);

------------------------------------------------------------------------------
-- Move
------------------------------------------------------------------------------
select throws_ok($$ select * from public.admin_move_booking('e4c00000-0000-0000-0000-000000000001', 'd4c00000-0000-0000-0000-000000000002') $$,
  'PB001', 'SLOT_FULL', 'cannot move into a full slot');
select throws_ok($$ select * from public.admin_move_booking('e4c00000-0000-0000-0000-000000000001', 'd4c00000-0000-0000-0000-000000000003') $$,
  'PB003', 'CLOSED', 'cannot move into a blocked slot');
select throws_ok($$ select * from public.admin_move_booking('e4c00000-0000-0000-0000-000000000001', 'd4c00000-0000-0000-0000-000000000004') $$,
  'PB003', 'CLOSED', 'cannot move into a past slot');
select throws_ok($$ select * from public.admin_move_booking('e4c00000-0000-0000-0000-000000000001', 'd4c00000-0000-0000-0000-000000000005') $$,
  'PB105', 'NOT_FOUND', 'cannot move into another campaign');

select is(
  (select campaign_title from public.admin_move_booking('e4c00000-0000-0000-0000-000000000001', 'd4c00000-0000-0000-0000-000000000006')),
  'Кампания А', 'admin can move after the public booking deadline'
);
select is((select slot_id from public.bookings where id = 'e4c00000-0000-0000-0000-000000000001'),
  'd4c00000-0000-0000-0000-000000000006'::uuid, 'the booking is in the new slot');

------------------------------------------------------------------------------
-- Cancel
------------------------------------------------------------------------------
select is(
  (select email from public.admin_cancel_booking('e4c00000-0000-0000-0000-000000000002')),
  'maria@test.invalid', 'admin cancels and gets the email data'
);
select throws_ok($$ select * from public.admin_cancel_booking('e4c00000-0000-0000-0000-000000000002') $$,
  'PB005', 'ALREADY_CANCELLED', 'second cancel is refused');
select throws_ok($$ select * from public.admin_move_booking('e4c00000-0000-0000-0000-000000000002', 'd4c00000-0000-0000-0000-000000000001') $$,
  'PB106', 'NOT_CONFIRMED', 'a cancelled booking can not be moved');

reset role;
select results_eq(
  $$ select action from public.audit_log where actor = 'admin:00000000-0000-0000-0000-00000000bc01' order by id $$,
  $$ values ('update'::text), ('booking_move'), ('admin_cancel') $$,
  'edit, move and cancel are audited (failures are not)'
);

select * from finish();
rollback;
