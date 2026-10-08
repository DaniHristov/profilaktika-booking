-- Production jobs (phase 5): reminders, confirmation retries, anonymization.
begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(18);

insert into public.campaigns (id, slug, title, location_address)
values ('c5000000-0000-0000-0000-000000000001', 'pj', 'Кампания', 'Адрес');

-- Times relative to "tomorrow 10:00 Sofia" so the test works any day.
insert into public.slots (id, campaign_id, starts_at, duration_min, capacity)
values
  ('d5000000-0000-0000-0000-000000000001', 'c5000000-0000-0000-0000-000000000001',
   (((now() at time zone 'Europe/Sofia')::date + 1) + time '10:00') at time zone 'Europe/Sofia', 30, 10),
  ('d5000000-0000-0000-0000-000000000002', 'c5000000-0000-0000-0000-000000000001',
   (((now() at time zone 'Europe/Sofia')::date + 2) + time '10:00') at time zone 'Europe/Sofia', 30, 10),
  ('d5000000-0000-0000-0000-000000000003', 'c5000000-0000-0000-0000-000000000001',
   now() - interval '13 months', 30, 10),
  ('d5000000-0000-0000-0000-000000000004', 'c5000000-0000-0000-0000-000000000001',
   now() - interval '11 months', 30, 10);

insert into public.bookings (id, campaign_id, slot_id, full_name, phone, email, consent_at, status, source, reminder_sent_at, confirmation_sent_at, created_at)
values
  -- tomorrow: due for a reminder
  ('e5000000-0000-0000-0000-000000000001', 'c5000000-0000-0000-0000-000000000001', 'd5000000-0000-0000-0000-000000000001',
   'Утре Едно', '+359888000001', 'u1@test.invalid', now(), 'confirmed', 'public', null, now(), now() - interval '1 hour'),
  -- tomorrow but reminder already sent
  ('e5000000-0000-0000-0000-000000000002', 'c5000000-0000-0000-0000-000000000001', 'd5000000-0000-0000-0000-000000000001',
   'Утре Две', '+359888000002', 'u2@test.invalid', now(), 'confirmed', 'public', now(), now(), now() - interval '1 hour'),
  -- tomorrow, cancelled
  ('e5000000-0000-0000-0000-000000000003', 'c5000000-0000-0000-0000-000000000001', 'd5000000-0000-0000-0000-000000000001',
   'Утре Три', '+359888000003', 'u3@test.invalid', now(), 'cancelled', 'public', null, now(), now() - interval '1 hour'),
  -- tomorrow, admin booking without email
  ('e5000000-0000-0000-0000-000000000004', 'c5000000-0000-0000-0000-000000000001', 'd5000000-0000-0000-0000-000000000001',
   'Утре Без Имейл', '+359888000004', null, now(), 'confirmed', 'admin', null, null, now() - interval '1 hour'),
  -- day after tomorrow, confirmation never sent, created 1 hour ago
  ('e5000000-0000-0000-0000-000000000005', 'c5000000-0000-0000-0000-000000000001', 'd5000000-0000-0000-0000-000000000002',
   'Вдругиден', '+359888000005', 'u5@test.invalid', now(), 'confirmed', 'public', null, null, now() - interval '1 hour'),
  -- unsent but just created (left to the immediate sender)
  ('e5000000-0000-0000-0000-000000000006', 'c5000000-0000-0000-0000-000000000001', 'd5000000-0000-0000-0000-000000000002',
   'Току-що', '+359888000006', 'u6@test.invalid', now(), 'confirmed', 'public', null, null, now()),
  -- unsent, but older than 72 hours: given up
  ('e5000000-0000-0000-0000-000000000007', 'c5000000-0000-0000-0000-000000000001', 'd5000000-0000-0000-0000-000000000002',
   'Стар Опит', '+359888000007', 'u7@test.invalid', now(), 'confirmed', 'public', null, null, now() - interval '4 days'),
  -- 13 months ago: to be anonymized (cancelled, with an admin edit in the audit log)
  ('e5000000-0000-0000-0000-000000000008', 'c5000000-0000-0000-0000-000000000001', 'd5000000-0000-0000-0000-000000000003',
   'Стар Записан', '+359888000008', 'old@test.invalid', now(), 'cancelled', 'public', null, now(), now() - interval '14 months'),
  -- 11 months ago: kept
  ('e5000000-0000-0000-0000-000000000009', 'c5000000-0000-0000-0000-000000000001', 'd5000000-0000-0000-0000-000000000004',
   'По-нов', '+359888000009', 'newer@test.invalid', now(), 'confirmed', 'public', null, now(), now() - interval '12 months');

insert into public.audit_log (booking_id, action, actor, entity_type, entity_id, payload)
values
  ('e5000000-0000-0000-0000-000000000008', 'update', 'admin:00000000-0000-0000-0000-000000000001', 'booking',
   'e5000000-0000-0000-0000-000000000008',
   '{"before": {"full_name": "Стар Записан"}, "after": {"full_name": "Стар Записан 2"}}'),
  ('e5000000-0000-0000-0000-000000000008', 'create', 'public', 'booking',
   'e5000000-0000-0000-0000-000000000008', '{"slot_id": "d5000000-0000-0000-0000-000000000003"}');

------------------------------------------------------------------------------
-- Privileges
------------------------------------------------------------------------------
select ok(not has_function_privilege('anon', 'public.bookings_due_for_reminder(int)', 'EXECUTE'), 'anon cannot list reminders');
select ok(not has_function_privilege('authenticated', 'public.bookings_due_for_reminder(int)', 'EXECUTE'), 'authenticated cannot list reminders');
select ok(not has_function_privilege('authenticated', 'public.bookings_needing_confirmation(int)', 'EXECUTE'), 'authenticated cannot list retries');
select ok(not has_function_privilege('authenticated', 'public.anonymize_old_bookings(int)', 'EXECUTE'), 'authenticated cannot anonymize');
select ok(has_function_privilege('service_role', 'public.anonymize_old_bookings(int)', 'EXECUTE'), 'service_role can anonymize');

------------------------------------------------------------------------------
-- Reminders and retries
------------------------------------------------------------------------------
select set_eq(
  $$ select booking_id from public.bookings_due_for_reminder(100) where campaign_title = 'Кампания' $$,
  array['e5000000-0000-0000-0000-000000000001'::uuid],
  'reminders: only tomorrow (Sofia), confirmed, with email and not yet reminded'
);

select set_eq(
  $$ select booking_id from public.bookings_needing_confirmation(100)
     where booking_id::text like 'e5000000%' $$,
  array['e5000000-0000-0000-0000-000000000005'::uuid],
  'retries: unsent, with email, 10 minutes to 72 hours old, future slot'
);

------------------------------------------------------------------------------
-- Anonymization
------------------------------------------------------------------------------
select throws_ok($$ select public.anonymize_old_bookings(0) $$, 'PB103', 'INVALID_INPUT', 'months must be positive');

select is(public.anonymize_old_bookings(12) >= 1, true, 'anonymizes old bookings');

select results_eq(
  $$ select full_name, phone, email, workplace, notes, anonymized_at is not null
     from public.bookings where id = 'e5000000-0000-0000-0000-000000000008' $$,
  $$ values ('Анонимизиран'::text, '+0000000'::text, null::text, null::text, null::text, true) $$,
  'personal data is removed'
);
select isnt(
  (select cancel_token::text from public.bookings where id = 'e5000000-0000-0000-0000-000000000008'),
  null, 'a new cancel token is set'
);
select is(
  (select full_name from public.bookings where id = 'e5000000-0000-0000-0000-000000000009'),
  'По-нов', 'bookings younger than the retention period are kept'
);
select is(
  (select status from public.bookings where id = 'e5000000-0000-0000-0000-000000000008'),
  'cancelled', 'the row stays for statistics'
);
select is(
  (select payload from public.audit_log where booking_id = 'e5000000-0000-0000-0000-000000000008' and action = 'update'),
  '{"anonymized": true}'::jsonb, 'personal data is removed from audit entries'
);
select is(
  (select payload from public.audit_log where booking_id = 'e5000000-0000-0000-0000-000000000008' and action = 'create'),
  '{"slot_id": "d5000000-0000-0000-0000-000000000003"}'::jsonb, 'id-only audit entries are untouched'
);
select is(
  (select actor || ':' || entity_type from public.audit_log where action = 'anonymize' order by id desc limit 1),
  'system:retention', 'the run itself is audited'
);
select is(public.anonymize_old_bookings(12), 0, 'running again changes nothing (idempotent)');
select is_empty(
  $$ select 1 from public.bookings_due_for_reminder(100) b
     join public.bookings x on x.id = b.booking_id where x.anonymized_at is not null $$,
  'anonymized bookings never get reminders'
);

select * from finish();
rollback;
