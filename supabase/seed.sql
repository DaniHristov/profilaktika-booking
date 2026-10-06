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
