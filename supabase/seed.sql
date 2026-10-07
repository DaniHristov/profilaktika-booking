-- Local development seed. Test data only, no personal data.
-- Slots are created for the next 2 working days (Mon–Fri) relative to the
-- moment of `supabase db reset`, 09:00–12:00 Europe/Sofia, every 30 minutes
-- (last slot starts at 11:30), capacity 1.

with campaign as (
  insert into public.campaigns (slug, title, location_address, location_note)
  values (
    'profilaktika-test',
    'Профилактични прегледи – Медицински център',
    'гр. София, ул. Примерна 1',
    'Етаж 2, кабинет 5'
  )
  returning id
),
days as (
  select d::date as day
  from generate_series(
    (now() at time zone 'Europe/Sofia')::date + 1,
    (now() at time zone 'Europe/Sofia')::date + 7,
    interval '1 day'
  ) as d
  where extract(isodow from d) < 6
  order by d
  limit 2
)
insert into public.slots (campaign_id, starts_at, duration_min, capacity)
select
  campaign.id,
  (days.day + time '09:00' + n * interval '30 minutes') at time zone 'Europe/Sofia',
  30,
  1
from campaign
cross join days
cross join generate_series(0, 5) as n;

-- Local admin for development only (sign in with this email; the magic link
-- arrives in Mailpit at http://127.0.0.1:54324). Production admins are added
-- manually, see README.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values (
  '00000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'admin@example.invalid', '', now(),
  '{"provider": "email", "providers": ["email"]}', '{}', now(), now(),
  '', '', '', ''
);

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (
  gen_random_uuid(), 'aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
  '{"sub": "aaaaaaaa-0000-4000-8000-000000000001", "email": "admin@example.invalid", "email_verified": true}',
  'email', now(), now(), now()
);

insert into public.admins (user_id, email)
values ('aaaaaaaa-0000-4000-8000-000000000001', 'admin@example.invalid');

-- A signed-up user who is NOT an admin, to check the "no access" screen.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values (
  '00000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-4000-8000-000000000002',
  'authenticated', 'authenticated', 'notadmin@example.invalid', '', now(),
  '{"provider": "email", "providers": ["email"]}', '{}', now(), now(),
  '', '', '', ''
);

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (
  gen_random_uuid(), 'aaaaaaaa-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000002',
  '{"sub": "aaaaaaaa-0000-4000-8000-000000000002", "email": "notadmin@example.invalid", "email_verified": true}',
  'email', now(), now(), now()
);
