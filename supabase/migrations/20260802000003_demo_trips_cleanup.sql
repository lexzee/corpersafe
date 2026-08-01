-- ============================================================================
-- CorperSafe — demo traffic cleanup (2026-08-02, part 4)
--
-- Lets admins STOP the "Simulate" demo and delete the fake trips straight
-- from the Mission Control navbar instead of the Supabase dashboard:
--
--   1. trips.is_demo flag — the app best-effort marks trips created by
--      generate_demo_traffic(), and existing demo trips are backfilled here.
--   2. delete_demo_traffic() — SECURITY DEFINER RPC that removes demo trips
--      plus their GPS breadcrumbs (trip_logs) and audit rows (alert_logs),
--      bypassing RLS. (The admin UI has no DELETE policy on trips, which is
--      exactly why this had to be a database function, not a client delete.)
--
--   Matching: is_demo = true OR the demo fingerprint used by the generator
--   (plate_number starting with "DEMO", or origin/institution containing
--   "demo"). Adjust the fingerprint below if your generator uses a
--   different convention.
--
-- Idempotent: safe to re-run at any time.
-- ============================================================================

-- 1. Demo flag ---------------------------------------------------------------
alter table public.trips add column if not exists is_demo boolean not null default false;

-- 2. One-time backfill so pre-existing demo trips are flagged too ------------
update public.trips
set is_demo = true
where plate_number ilike 'DEMO%'
   or origin ilike '%demo%'
   or institution ilike '%demo%';

-- 3. Delete RPC (SECURITY DEFINER → runs as the table owner, bypasses RLS) ---
create or replace function public.delete_demo_traffic()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
  demo_ids uuid[];
begin
  select array_agg(id)
  into demo_ids
  from public.trips
  where is_demo
     or plate_number ilike 'DEMO%'
     or origin ilike '%demo%'
     or institution ilike '%demo%';

  if demo_ids is null then
    return 0;
  end if;

  delete from public.trip_logs where trip_id = any(demo_ids);
  delete from public.alert_logs where trip_id = any(demo_ids);
  delete from public.trips where id = any(demo_ids);
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Sanity checks (run in the SQL editor):
--   select count(*) from public.trips where is_demo;
--   select public.delete_demo_traffic();   -- returns the number removed
