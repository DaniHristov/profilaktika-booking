-- Export audit (phase 4d).
begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(4);

insert into auth.users (id, instance_id, aud, role, email)
values
  ('00000000-0000-0000-0000-00000000ec01', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a4d@test.invalid'),
  ('00000000-0000-0000-0000-00000000ec02', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'u4d@test.invalid');
insert into public.admins (user_id, email) values ('00000000-0000-0000-0000-00000000ec01', 'a4d@test.invalid');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000ec02","role":"authenticated"}', true);
select throws_ok($$ select public.admin_log_export('standard', 'csv', '{}', 3) $$, 'PB100', 'NOT_ADMIN', 'non-admin cannot log exports');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000ec01","role":"authenticated"}', true);
select throws_ok($$ select public.admin_log_export('standard', 'pdf', '{}', 3) $$, 'PB103', 'INVALID_INPUT', 'unknown format is refused');
select lives_ok($$ select public.admin_log_export('joystick', 'csv', '{"status":"confirmed"}', 12) $$, 'admin export is logged');
reset role;

select results_eq(
  $$ select action, entity_type, payload from public.audit_log where actor = 'admin:00000000-0000-0000-0000-00000000ec01' $$,
  $$ values ('export'::text, 'export'::text,
             '{"profile": "joystick", "format": "csv", "filters": {"status": "confirmed"}, "row_count": 12}'::jsonb) $$,
  'the audit entry has profile, format, filters and row count, but no personal data'
);

select * from finish();
rollback;
