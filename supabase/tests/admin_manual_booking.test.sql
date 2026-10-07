-- Manual booking by an admin (phase 4e).
begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(14);

insert into auth.users (id, instance_id, aud, role, email)
values
  ('00000000-0000-0000-0000-00000000ee01', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a4e@test.invalid'),
  ('00000000-0000-0000-0000-00000000ee02', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'u4e@test.invalid');
insert into public.admins (user_id, email) values ('00000000-0000-0000-0000-00000000ee01', 'a4e@test.invalid');

insert into public.campaigns (id, slug, title, location_address, is_active)
values ('c4e00000-0000-0000-0000-000000000001', 'mb', 'Ръчни', 'Адрес', false);
insert into public.slots (id, campaign_id, starts_at, duration_min, capacity, is_blocked)
values
  ('d4e00000-0000-0000-0000-000000000001', 'c4e00000-0000-0000-0000-000000000001', now() + interval '30 minutes', 30, 1, false),
  ('d4e00000-0000-0000-0000-000000000002', 'c4e00000-0000-0000-0000-000000000001', now() + interval '3 days', 30, 1, true),
  ('d4e00000-0000-0000-0000-000000000003', 'c4e00000-0000-0000-0000-000000000001', now() + interval '3 days 1 hour', 30, 2, false);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000ee02","role":"authenticated"}', true);
select throws_ok($$ select * from public.admin_book_slot('d4e00000-0000-0000-0000-000000000003', 'X Y', '+359888000000', null, null, null) $$,
  'PB100', 'NOT_ADMIN', 'non-admin cannot book manually');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000ee01","role":"authenticated"}', true);

create temp table b1 on commit drop as
select * from public.admin_book_slot('d4e00000-0000-0000-0000-000000000001', '  Обадил   се ', '+359888000001', '', ' Фирма ', null);
select is((select count(*)::int from b1), 1, 'admin books without email, after the public deadline, in an inactive campaign');

select throws_ok($$ select * from public.admin_book_slot('d4e00000-0000-0000-0000-000000000001', 'Друг', '+359888000002', null, null, null) $$,
  'PB001', 'SLOT_FULL', 'capacity applies');
select throws_ok($$ select * from public.admin_book_slot('d4e00000-0000-0000-0000-000000000002', 'Друг', '+359888000002', null, null, null) $$,
  'PB003', 'CLOSED', 'blocked slot is refused');

select lives_ok($$ select * from public.admin_book_slot('d4e00000-0000-0000-0000-000000000003', 'С имейл', '+359888000003', 'Mail@Test.invalid', null, null) $$,
  'admin books with an email');
select throws_ok($$ select * from public.admin_book_slot('d4e00000-0000-0000-0000-000000000003', 'Пак', '+359888000004', 'mail@test.invalid', null, null) $$,
  'PB002', 'DUPLICATE_EMAIL', 'one active booking per email still applies');
select lives_ok($$ select * from public.admin_book_slot('d4e00000-0000-0000-0000-000000000003', 'Без имейл 2', '+359888000005', null, null, null) $$,
  'several bookings without email are allowed');
reset role;

select results_eq(
  $$ select full_name, email, workplace, source, created_by from public.bookings where id = (select booking_id from b1) $$,
  $$ values ('Обадил се'::text, null::text, 'Фирма'::text, 'admin'::text, '00000000-0000-0000-0000-00000000ee01'::uuid) $$,
  'stores normalized data, source admin and the admin who entered it'
);
select isnt((select consent_at from public.bookings where id = (select booking_id from b1)), null, 'oral consent time is stored');
select results_eq(
  $$ select action, actor, payload from public.audit_log where booking_id = (select booking_id from b1) $$,
  $$ values ('create'::text, 'admin:00000000-0000-0000-0000-00000000ee01'::text,
             jsonb_build_object('slot_id', 'd4e00000-0000-0000-0000-000000000001', 'source', 'admin', 'consent', 'oral')) $$,
  'manual booking is audited'
);

-- Public bookings still require an email and can not claim an admin.
select throws_ok(
  $$ insert into public.bookings (campaign_id, slot_id, full_name, phone, email, consent_at)
     values ('c4e00000-0000-0000-0000-000000000001', 'd4e00000-0000-0000-0000-000000000003', 'X', '+359888000006', null, now()) $$,
  '23514', null, 'public bookings need an email'
);
select throws_ok(
  $$ insert into public.bookings (campaign_id, slot_id, full_name, phone, email, consent_at, created_by)
     values ('c4e00000-0000-0000-0000-000000000001', 'd4e00000-0000-0000-0000-000000000003', 'X', '+359888000006', 'x@test.invalid', now(), '00000000-0000-0000-0000-00000000ee01') $$,
  '23514', null, 'created_by is only for admin bookings'
);
select is((select source from public.bookings where email = 'mail@test.invalid'), 'admin', 'source is admin');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000ee01","role":"authenticated"}', true);
select lives_ok(
  $$ select public.admin_update_booking((select id from public.bookings where email = 'mail@test.invalid'), 'С имейл', '+359888000003', '', null, null) $$,
  'the email of an admin booking can be cleared'
);
reset role;

select * from finish();
rollback;
