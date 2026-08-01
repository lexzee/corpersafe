-- ============================================================================
-- Public (anonymous) trip tracking
--
-- Parents/guardians follow shared /track?code=NYSC-XXXXX links WITHOUT an
-- account. For that to work, the anon role needs (a) scoped SELECT policies
-- on trips + profiles and (b) trips in the realtime publication.
--
-- SECURITY NOTES:
--  * RLS cannot require "a valid tracking code in the WHERE clause", and
--    codes are short (90k combinations, enumerable). These policies expose
--    every NON-COMPLETED trip to anonymous read. Treat anything in those
--    rows as public-by-design; resolved/completed journeys are excluded.
--  * Hardening path: replace #2 with a postgres-owned view exposing only
--    (tracking_code, status, coords, timestamps) and drop the profiles
--    join from the public query, then lengthen tracking codes.
-- ============================================================================

-- 1. Make sure RLS is on (no-op if already enabled)
alter table public.trips enable row level security;
alter table public.profiles enable row level security;

-- 2. Anonymous + authenticated read of NON-COMPLETED/non-resolved trips
drop policy if exists "public_track_trips" on public.trips;
create policy "public_track_trips"
  on public.trips
  for select
  to anon, authenticated
  using (status not in ('completed', 'resolved'));

-- 3. Passenger card readable ONLY for travelers on a live trip
drop policy if exists "public_track_profiles" on public.profiles;
create policy "public_track_profiles"
  on public.profiles
  for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.trips t
      where t.pcm_id = profiles.id
        and t.status not in ('completed', 'resolved')
    )
  );

-- 4. Stream trips row updates to realtime subscribers (idempotent)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'trips'
  ) then
    alter publication supabase_realtime add table public.trips;
  end if;
end $$;

-- Rollback:
--   drop policy if exists "public_track_trips" on public.trips;
--   drop policy if exists "public_track_profiles" on public.profiles;
--   alter publication supabase_realtime drop table public.trips;
