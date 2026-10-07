-- Access-control tests: privileges, RLS and the public read functions.
-- Run with `npm run test:db` (supabase test db). Everything is rolled back.
begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(30);

------------------------------------------------------------------------------
-- Fixtures (as postgres)
------------------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email)
values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'admin@test.invalid'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'user@test.invalid');

insert into public.admins (user_id, email)
values ('00000000-0000-0000-0000-0000000000a1', 'admin@test.invalid');

insert into public.campaigns (id, slug, title, location_address, is_active, booking_closes_hours_before)
values
  ('10000000-0000-0000-0000-000000000001', 'rls-active', 'Активна', 'Адрес 1', true, 2),
  ('10000000-0000-0000-0000-000000000002', 'rls-inactive', 'Неактивна', 'Адрес 2', false, 2);

insert into public.slots (id, campaign_id, starts_at, duration_min, capacity, is_blocked)
values
  -- free, capacity 2, one booking -> available 1
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
   now() + interval '3 days', 30, 2, false),
  -- full, capacity 1, one booking -> available 0, still returned
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001',
   now() + interval '3 days 30 minutes', 30, 1, false),
  -- blocked -> hidden
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001',
   now() + interval '3 days 1 hour', 30, 1, true),
  -- inside booking_closes_hours_before window -> hidden
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001',
   now() + interval '1 hour', 30, 1, false),
  -- in the past -> hidden
  ('20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001',
   now() - interval '1 day', 30, 1, false),
  -- inactive campaign -> hidden
  ('20000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000002',
   now() + interval '3 days', 30, 1, false);

insert into public.bookings (campaign_id, slot_id, full_name, phone, email, consent_at)
values
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
   'Тест Едно', '+359888000001', 'one@test.invalid', now()),
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002',
   'Тест Две', '+359888000002', 'two@test.invalid', now()),
  -- cancelled bookings do not take capacity
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
   'Тест Три', '+359888000003', 'three@test.invalid', now());
update public.bookings set status = 'cancelled' where email = 'three@test.invalid';

------------------------------------------------------------------------------
-- Schema-wide guarantees
------------------------------------------------------------------------------
select is_empty(
  $$ select c.relname from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity $$,
  'RLS is enabled on every table in public'
);

select is_empty(
  $$ select c.relname from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r', 'v', 'm', 'S')
       and (has_table_privilege('anon', c.oid, 'SELECT')
         or has_table_privilege('anon', c.oid, 'INSERT')
         or has_table_privilege('anon', c.oid, 'UPDATE')
         or has_table_privilege('anon', c.oid, 'DELETE')
         or has_table_privilege('anon', c.oid, 'TRUNCATE')) $$,
  'anon has no privileges on any table, view or sequence in public'
);

select set_eq(
  $$ select p.proname::text from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'EXECUTE') $$,
  array['get_availability', 'get_campaign_public'],
  'anon can execute only get_availability and get_campaign_public'
);

select set_eq(
  $$ select p.proname::text from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and has_function_privilege('authenticated', p.oid, 'EXECUTE') $$,
  array['get_availability', 'get_campaign_public', 'is_admin',
        'admin_save_campaign', 'admin_generate_slots', 'admin_update_slot', 'admin_delete_slot',
        'admin_list_bookings', 'admin_update_booking', 'admin_move_booking', 'admin_cancel_booking'],
  'authenticated can execute only the public functions, is_admin and the admin_* functions'
);

select is_empty(
  $$ select p.proname from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prosecdef
       and not coalesce(p.proconfig @> array['search_path=""'], false) $$,
  'every security definer function pins search_path to empty'
);

select is(
  pg_get_function_result('public.get_availability(text)'::regprocedure),
  'TABLE(slot_id uuid, starts_at timestamp with time zone, duration_min integer, available_count integer)',
  'get_availability returns only slot data, no personal data'
);

select is(
  pg_get_function_result('public.get_campaign_public(text)'::regprocedure),
  'TABLE(title text, location_address text, location_note text, is_active boolean)',
  'get_campaign_public returns only public campaign fields'
);

------------------------------------------------------------------------------
-- anon
------------------------------------------------------------------------------
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select throws_ok($$ select * from public.bookings $$, '42501', null, 'anon cannot read bookings');
select throws_ok($$ select * from public.slots $$, '42501', null, 'anon cannot read slots');
select throws_ok($$ select * from public.campaigns $$, '42501', null, 'anon cannot read campaigns');
select throws_ok($$ select * from public.admins $$, '42501', null, 'anon cannot read admins');
select throws_ok($$ select * from public.audit_log $$, '42501', null, 'anon cannot read audit_log');
select throws_ok(
  $$ insert into public.bookings (campaign_id, slot_id, full_name, phone, email, consent_at)
     values ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
             'X', '+359888000009', 'x@test.invalid', now()) $$,
  '42501', null, 'anon cannot insert bookings directly'
);
select throws_ok($$ select public.is_admin() $$, '42501', null, 'anon cannot execute is_admin');

select results_eq(
  $$ select slot_id, available_count from public.get_availability('rls-active') $$,
  $$ values ('20000000-0000-0000-0000-000000000001'::uuid, 1),
            ('20000000-0000-0000-0000-000000000002'::uuid, 0) $$,
  'get_availability: free and full slots only; blocked, past and closing-window slots hidden; cancelled bookings free capacity'
);

select is_empty(
  $$ select * from public.get_availability('rls-inactive') $$,
  'get_availability: inactive campaign returns nothing'
);

select is_empty(
  $$ select * from public.get_availability('does-not-exist') $$,
  'get_availability: unknown slug returns nothing'
);

select results_eq(
  $$ select title, is_active from public.get_campaign_public('rls-inactive') $$,
  $$ values ('Неактивна'::text, false) $$,
  'get_campaign_public: returns inactive campaign so the UI can say booking is closed'
);

reset role;

------------------------------------------------------------------------------
-- authenticated, not an admin
------------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);

select is((select public.is_admin()), false, 'non-admin: is_admin() is false');
select is_empty($$ select * from public.bookings $$, 'non-admin sees no bookings');
select is_empty($$ select * from public.campaigns $$, 'non-admin sees no campaigns');
select is_empty($$ select * from public.slots $$, 'non-admin sees no slots');
select is_empty($$ select * from public.admins $$, 'non-admin sees no admins');
select throws_ok(
  $$ insert into public.campaigns (slug, title, location_address) values ('x', 'X', 'X') $$,
  '42501', null, 'non-admin cannot create campaigns'
);

reset role;

------------------------------------------------------------------------------
-- authenticated admin
------------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);

select is((select public.is_admin()), true, 'admin: is_admin() is true');
select is((select count(*)::int from public.bookings where campaign_id = '10000000-0000-0000-0000-000000000001'), 3, 'admin sees all bookings');
select is((select count(*)::int from public.slots where campaign_id in ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002')), 6, 'admin sees all slots, including blocked, past and inactive');

select lives_ok(
  $$ insert into public.campaigns (slug, title, location_address) values ('admin-made', 'Нова', 'Адрес') $$,
  'admin can create campaigns'
);

select throws_ok(
  $$ insert into public.bookings (campaign_id, slot_id, full_name, phone, email, consent_at)
     values ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
             'X', '+359888000009', 'x@test.invalid', now()) $$,
  '42501', null, 'admin cannot insert bookings directly (only via book_slot)'
);

-- No delete policy: the statement succeeds but affects no rows.
delete from public.bookings;
reset role;
select is((select count(*)::int from public.bookings where campaign_id = '10000000-0000-0000-0000-000000000001'), 3, 'bookings cannot be deleted, even by an admin');

select * from finish();
rollback;
