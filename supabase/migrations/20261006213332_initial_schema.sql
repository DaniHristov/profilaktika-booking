-- Initial schema: campaigns, slots, bookings, admins, audit_log.
-- Access model (see CLAUDE.md, "Взети решения"):
--   * RLS on every table; anon has no table privileges at all.
--   * authenticated gets explicit table grants; RLS limits it to admins via is_admin().
--   * Every function: execute revoked from public, then granted explicitly.

------------------------------------------------------------------------------
-- Default privileges
-- Mirror the hosted project setting "Automatically expose new tables = off" so
-- local and hosted behave the same: nothing created later in public is exposed
-- to API roles unless a migration grants it explicitly.
------------------------------------------------------------------------------
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

------------------------------------------------------------------------------
-- Tables
------------------------------------------------------------------------------
create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 80),
  title text not null check (length(btrim(title)) between 1 and 200),
  location_address text not null check (length(btrim(location_address)) between 1 and 300),
  location_note text check (length(location_note) <= 300),
  is_active boolean not null default true,
  booking_closes_hours_before int not null default 2
    check (booking_closes_hours_before between 0 and 720),
  created_at timestamptz not null default now()
);

create table public.slots (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete restrict,
  starts_at timestamptz not null,
  duration_min int not null check (duration_min between 5 and 480),
  capacity int not null default 1 check (capacity between 1 and 100),
  is_blocked boolean not null default false,
  unique (campaign_id, starts_at),
  -- Target of the composite FK from bookings.
  unique (id, campaign_id)
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null,
  slot_id uuid not null,
  full_name text not null check (length(btrim(full_name)) between 1 and 100),
  -- E.164, e.g. +359888123456 (normalized by libphonenumber-js before insert).
  phone text not null check (phone ~ '^\+[0-9]{7,15}$' and length(phone) <= 20),
  email text not null check (length(email) <= 254 and position('@' in email) > 1),
  workplace text check (length(workplace) <= 150),
  notes text check (length(notes) <= 1000),
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled')),
  cancel_token uuid not null default gen_random_uuid() unique,
  consent_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Guarantees the slot belongs to the same campaign as the booking.
  foreign key (slot_id, campaign_id)
    references public.slots (id, campaign_id) on delete restrict
);

-- One person = one active booking per campaign.
create unique index bookings_one_active_per_email
  on public.bookings (campaign_id, lower(email))
  where status = 'confirmed';

-- Capacity counting in get_availability / book_slot.
create index bookings_confirmed_by_slot
  on public.bookings (slot_id)
  where status = 'confirmed';

create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  booking_id uuid references public.bookings (id) on delete set null,
  action text not null check (action in ('create', 'update', 'cancel', 'admin_cancel')),
  -- 'public' or 'admin:<user_id>'
  actor text not null check (actor = 'public' or actor ~ '^admin:[0-9a-f-]{36}$'),
  -- May contain personal data; the retention job anonymizes it with the booking.
  payload jsonb,
  created_at timestamptz not null default now()
);

create index audit_log_booking_id on public.audit_log (booking_id);

------------------------------------------------------------------------------
-- updated_at trigger
------------------------------------------------------------------------------
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger bookings_set_updated_at
  before update on public.bookings
  for each row execute function public.set_updated_at();

------------------------------------------------------------------------------
-- is_admin()
------------------------------------------------------------------------------
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admins where user_id = auth.uid()
  );
$$;

------------------------------------------------------------------------------
-- Public read functions (no personal data)
------------------------------------------------------------------------------
create function public.get_campaign_public(p_slug text)
returns table (
  title text,
  location_address text,
  location_note text,
  is_active boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.title, c.location_address, c.location_note, c.is_active
  from public.campaigns c
  where c.slug = p_slug;
$$;

-- Bookable slots of an active campaign: not blocked and starting after
-- now() + booking_closes_hours_before. Full slots are returned with
-- available_count = 0 so the UI can show them as taken.
create function public.get_availability(p_slug text)
returns table (
  slot_id uuid,
  starts_at timestamptz,
  duration_min int,
  available_count int
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.id,
    s.starts_at,
    s.duration_min,
    greatest(s.capacity - coalesce(b.confirmed, 0), 0)::int
  from public.campaigns c
  join public.slots s on s.campaign_id = c.id
  left join lateral (
    select count(*)::int as confirmed
    from public.bookings bk
    where bk.slot_id = s.id
      and bk.status = 'confirmed'
  ) b on true
  where c.slug = p_slug
    and c.is_active
    and not s.is_blocked
    and s.starts_at > now() + make_interval(hours => c.booking_closes_hours_before)
  order by s.starts_at;
$$;

------------------------------------------------------------------------------
-- Function privileges
------------------------------------------------------------------------------
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.is_admin() from public, anon, authenticated;
revoke execute on function public.get_campaign_public(text) from public, anon, authenticated;
revoke execute on function public.get_availability(text) from public, anon, authenticated;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.get_campaign_public(text) to anon, authenticated;
grant execute on function public.get_availability(text) to anon, authenticated;

------------------------------------------------------------------------------
-- Table privileges
------------------------------------------------------------------------------
revoke all on public.campaigns, public.slots, public.bookings, public.admins, public.audit_log
  from anon, authenticated;
revoke all on sequence public.audit_log_id_seq from anon, authenticated;

-- Admin UI tables. RLS decides what each authenticated user may actually do.
grant select, insert, update, delete on public.campaigns, public.slots, public.bookings
  to authenticated;
-- Read-only for admins; rows are written by security definer functions only.
grant select on public.admins, public.audit_log to authenticated;

-- Server-side jobs (cron: keepalive, reminders, retention) use the service role.
grant select, insert, update, delete on public.campaigns, public.slots, public.bookings,
  public.admins, public.audit_log to service_role;
grant usage, select on sequence public.audit_log_id_seq to service_role;

------------------------------------------------------------------------------
-- Row level security
------------------------------------------------------------------------------
alter table public.campaigns enable row level security;
alter table public.slots enable row level security;
alter table public.bookings enable row level security;
alter table public.admins enable row level security;
alter table public.audit_log enable row level security;

-- (select ...) lets Postgres evaluate is_admin() once per statement.
create policy campaigns_admin_all on public.campaigns
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy slots_admin_all on public.slots
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Bookings: admins read and edit. No insert policy (bookings are created only
-- through book_slot, which locks the slot) and no delete policy (bookings are
-- never deleted, only cancelled or anonymized).
create policy bookings_admin_select on public.bookings
  for select to authenticated
  using ((select public.is_admin()));

create policy bookings_admin_update on public.bookings
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy admins_admin_select on public.admins
  for select to authenticated
  using ((select public.is_admin()));

create policy audit_log_admin_select on public.audit_log
  for select to authenticated
  using ((select public.is_admin()));
