-- Admin functions for campaigns and slots (phase 4b).
begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(28);

------------------------------------------------------------------------------
-- Fixtures: an admin and a signed-in non-admin
------------------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email)
values
  ('00000000-0000-0000-0000-00000000ad01', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a4b@test.invalid'),
  ('00000000-0000-0000-0000-00000000ad02', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'u4b@test.invalid');
insert into public.admins (user_id, email) values ('00000000-0000-0000-0000-00000000ad01', 'a4b@test.invalid');

create function pg_temp.as_user(p_id text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;

------------------------------------------------------------------------------
-- Non-admin and anon are refused
------------------------------------------------------------------------------
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000ad02');

select throws_ok(
  $$ select public.admin_save_campaign(null, 'x-camp', 'X', 'Адрес', null, true, 2, true, 0) $$,
  'PB100', 'NOT_ADMIN', 'non-admin cannot create a campaign'
);
select throws_ok(
  $$ select * from public.admin_generate_slots(gen_random_uuid(), array[current_date + 7], '09:00', '10:00', 30, 1, true) $$,
  'PB100', 'NOT_ADMIN', 'non-admin cannot generate slots'
);
select is_empty($$ select * from public.admin_campaign_stats $$, 'non-admin sees no campaign stats');
reset role;

select ok(not has_function_privilege('anon', 'public.admin_save_campaign(uuid, text, text, text, text, boolean, int, boolean, int)', 'EXECUTE'),
  'anon cannot execute admin_save_campaign');
select ok(not has_table_privilege('anon', 'public.admin_slot_stats', 'SELECT'), 'anon cannot read admin_slot_stats');

------------------------------------------------------------------------------
-- Campaigns
------------------------------------------------------------------------------
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000ad01');

create temp table camp on commit drop as
select public.admin_save_campaign(null, '  Firma-Test ', ' Прегледи ', ' Адрес 1 ', '  ', true, 2, true, 0) as id;

select results_eq(
  $$ select slug, title, location_address, location_note from public.campaigns where id = (select id from camp) $$,
  $$ values ('firma-test'::text, 'Прегледи'::text, 'Адрес 1'::text, null::text) $$,
  'creates a campaign with normalized values'
);

select throws_ok(
  $$ select public.admin_save_campaign(null, 'firma-test', 'Друга', 'Адрес', null, true, 2, true, 0) $$,
  'PB104', 'SLUG_TAKEN', 'duplicate slug raises SLUG_TAKEN'
);
select throws_ok(
  $$ select public.admin_save_campaign(null, 'Bad Slug!', 'X', 'Адрес', null, true, 2, true, 0) $$,
  'PB103', 'INVALID_INPUT', 'invalid slug raises INVALID_INPUT'
);

select lives_ok(
  $$ select public.admin_save_campaign((select id from camp), 'firma-test', 'Прегледи 2', 'Адрес 2', 'Етаж 1', false, 4, false, 24) $$,
  'updates a campaign'
);
select results_eq(
  $$ select title, is_active, booking_closes_hours_before, allow_public_cancel, cancel_closes_hours_before
     from public.campaigns where id = (select id from camp) $$,
  $$ values ('Прегледи 2'::text, false, 4, false, 24) $$,
  'all settings are saved'
);

------------------------------------------------------------------------------
-- Slot generator
------------------------------------------------------------------------------
-- Dry run: 09:00-12:00 every 30 min = 6 slots, nothing written.
select is(
  (select count(*)::int from public.admin_generate_slots((select id from camp), array[current_date + 10], '09:00', '12:00', 30, 1, true)),
  6, 'dry run previews 6 slots for 09:00-12:00 / 30 min'
);
select is((select count(*)::int from public.slots where campaign_id = (select id from camp)), 0, 'dry run writes nothing');

-- The last slot must end by the end time: 09:00-10:45 / 30 min = 09:00, 09:30, 10:00.
select is(
  (select count(*)::int from public.admin_generate_slots((select id from camp), array[current_date + 10], '09:00', '10:45', 30, 1, true)),
  3, 'the last slot ends by the end time'
);

select is(
  (select array_agg(status order by starts_at) from public.admin_generate_slots(
     (select id from camp), array[current_date + 10, current_date + 11], '09:00', '12:00', 30, 2, false)),
  array_fill('new'::text, array[12]),
  'creates 12 slots for 2 days'
);
select is(
  (select count(*)::int from public.slots where campaign_id = (select id from camp) and capacity = 2 and duration_min = 30),
  12, 'slots are stored with the given capacity and duration'
);

-- Break via two runs: 09:00-12:00 already exists, 13:00-14:00 adds 2.
select results_eq(
  $$ select status, count(*)::int from public.admin_generate_slots(
       (select id from camp), array[current_date + 10], '09:00', '14:00', 30, 1, false)
     group by status order by status $$,
  $$ values ('exists'::text, 6), ('new'::text, 4) $$,
  'existing slots are skipped and reported'
);

select is(
  (select array_agg(status) from public.admin_generate_slots((select id from camp), array[current_date - 1], '09:00', '10:00', 30, 1, false)),
  array['past', 'past'], 'slots in the past are skipped'
);

select throws_ok(
  $$ select * from public.admin_generate_slots((select id from camp), array[current_date + 10], '12:00', '09:00', 30, 1, true) $$,
  'PB103', 'INVALID_INPUT', 'end before start raises INVALID_INPUT'
);

-- DST: Europe/Sofia goes from UTC+3 to UTC+2 on 25.10.2026.
select is(
  (select array_agg(to_char(starts_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI') order by starts_at)
   from public.admin_generate_slots((select id from camp), array['2026-10-23'::date, '2026-10-26'::date], '09:00', '09:30', 30, 1, true)),
  array['2026-10-23 06:00', '2026-10-26 07:00'],
  '09:00 Sofia is 06:00 UTC in summer time and 07:00 UTC in winter time'
);

------------------------------------------------------------------------------
-- Single slots
------------------------------------------------------------------------------
create temp table s1 on commit drop as
select id from public.slots where campaign_id = (select id from camp) order by starts_at limit 1;

reset role;
update public.campaigns set is_active = true where id = (select id from camp);
insert into public.bookings (campaign_id, slot_id, full_name, phone, email, consent_at)
values ((select id from camp), (select id from s1), 'Тест', '+359888000001', 'b1@test.invalid', now()),
       ((select id from camp), (select id from s1), 'Тест', '+359888000002', 'b2@test.invalid', now());
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000ad01');

select throws_ok(
  $$ select public.admin_update_slot((select id from s1), false, 1) $$,
  'PB102', 'CAPACITY_BELOW_BOOKED', 'capacity can not go below confirmed bookings'
);
select lives_ok($$ select public.admin_update_slot((select id from s1), true, 3) $$, 'block and raise capacity');
select results_eq(
  $$ select is_blocked, capacity from public.slots where id = (select id from s1) $$,
  $$ values (true, 3) $$, 'slot is blocked with capacity 3'
);
select results_eq(
  $$ select confirmed_count, total_bookings from public.admin_slot_stats where id = (select id from s1) $$,
  $$ values (2, 2) $$, 'admin_slot_stats counts bookings'
);

reset role;
update public.bookings set status = 'cancelled' where slot_id = (select id from s1);
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000ad01');

select throws_ok(
  $$ select public.admin_delete_slot((select id from s1)) $$,
  'PB101', 'SLOT_HAS_BOOKINGS', 'a slot with (even cancelled) bookings can not be deleted'
);

create temp table s2 on commit drop as
select id from public.slots where campaign_id = (select id from camp) order by starts_at desc limit 1;
select lives_ok($$ select public.admin_delete_slot((select id from s2)) $$, 'an empty slot can be deleted');
select is_empty($$ select 1 from public.slots where id = (select id from s2) $$, 'the slot is gone');

------------------------------------------------------------------------------
-- Audit
------------------------------------------------------------------------------
reset role;
select results_eq(
  $$ select action, actor, entity_type from public.audit_log
     where actor = 'admin:00000000-0000-0000-0000-00000000ad01' order by id $$,
  $$ values
     ('campaign_create'::text, 'admin:00000000-0000-0000-0000-00000000ad01'::text, 'campaign'::text),
     ('campaign_update', 'admin:00000000-0000-0000-0000-00000000ad01', 'campaign'),
     ('slots_generate', 'admin:00000000-0000-0000-0000-00000000ad01', 'campaign'),
     ('slots_generate', 'admin:00000000-0000-0000-0000-00000000ad01', 'campaign'),
     ('slots_generate', 'admin:00000000-0000-0000-0000-00000000ad01', 'campaign'),
     ('slot_update', 'admin:00000000-0000-0000-0000-00000000ad01', 'slot'),
     ('slot_delete', 'admin:00000000-0000-0000-0000-00000000ad01', 'slot') $$,
  'every admin change is audited once (dry runs and failures are not)'
);
select is(
  (select (payload->>'created')::int from public.audit_log
   where action = 'slots_generate' and actor = 'admin:00000000-0000-0000-0000-00000000ad01' order by id limit 1),
  12, 'the generate audit entry records how many slots were created'
);

select * from finish();
rollback;
