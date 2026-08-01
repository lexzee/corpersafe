-- ============================================================================
-- CorperSafe — critical schema fixes (2026-08-02)
--
--   1. Recreate the missing auth.users -> public.profiles trigger so every new
--      signup automatically gets a profiles row (fixes:
--      "insert or update on table "trips" violates foreign key constraint
--      "trips_pcm_id_fkey"", detail 'Key is not present in table "profiles"').
--   2. Backfill profiles for auth.users rows that have none (repairs existing
--      accounts created while the trigger was missing).
--   3. Add an INSERT policy for profiles (self-heal path in the app needs it).
--   4. Provide SECURITY DEFINER helpers (public.is_admin,
--      public.has_live_trip) so RLS policies never sub-select the profiles
--      table directly -> no more 42P17 "infinite recursion" on profiles.
--   5. Rebuild the public_track_profiles policy on has_live_trip() so parents
--      can see traveler names/phones during live trips.
--   6. Enum-safe casting: profiles.role is a user_role ENUM, and signup
--      metadata arrives as text. safe_user_role() casts it safely so a bad or
--      missing label can never break signup (fixes:
--      42804 "column "role" is of type user_role but expression is of type text").
--
-- Idempotent: safe to re-run at any time (e.g. after a partial earlier run).
-- ============================================================================

-- 0. Enum-safe role caster ----------------------------------------------------
create or replace function public.safe_user_role(p text)
returns public.user_role
language plpgsql
set search_path = ''
as $$
begin
  return coalesce(nullif(p, ''), 'pcm')::public.user_role;
exception
  when invalid_text_representation then
    return 'pcm'::public.user_role;
end;
$$;

-- 1. Profile auto-creation -----------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, phone, role, next_of_kin, next_of_kin_email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'phone', ''),
    public.safe_user_role(new.raw_user_meta_data ->> 'role'),
    coalesce(new.raw_user_meta_data ->> 'next_of_kin', ''),
    coalesce(new.raw_user_meta_data ->> 'next_of_kin_email', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. Backfill missing profiles -------------------------------------------------
insert into public.profiles (id, full_name, phone, role, next_of_kin, next_of_kin_email)
select
  u.id,
  coalesce(u.raw_user_meta_data ->> 'full_name', ''),
  coalesce(u.raw_user_meta_data ->> 'phone', ''),
  public.safe_user_role(u.raw_user_meta_data ->> 'role'),
  coalesce(u.raw_user_meta_data ->> 'next_of_kin', ''),
  coalesce(u.raw_user_meta_data ->> 'next_of_kin_email', '')
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;

-- 3. INSERT self policy for profiles ------------------------------------------
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

-- 4. SECURITY DEFINER helpers --------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select coalesce(
    (select p.role::text in ('admin', 'super_admin', 'state_admin', 'school_admin')
     from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

create or replace function public.has_live_trip(profile_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.trips t
    where t.pcm_id = profile_id
      and t.status not in ('completed', 'resolved')
  );
$$;

-- 5. Anonymous parent tracking -----------------------------------------------
drop policy if exists "public_track_profiles" on public.profiles;
create policy "public_track_profiles"
  on public.profiles for select to anon
  using (public.has_live_trip(id));

-- ----------------------------------------------------------------------------
-- Sanity checks (uncomment if you want to verify):
--   select t.typname, e.enumlabel            -- which role labels exist
--   from pg_enum e join pg_type t on t.oid = e.enumtypid
--   where t.typname = 'user_role' order by e.enumsortorder;
--
--   select policyname, cmd, qual, with_check from pg_policies
--   where schemaname = 'public' and tablename in ('profiles', 'trips');
-- ----------------------------------------------------------------------------

-- ============================================================================
-- 6. RECURSION-PROOF POLICY REWRITES (templates — commented out)
--
-- The exact broken policies can't be dropped blind. Run the pg_policies query
-- above, then for every policy whose qual/with_check sub-selects profiles:
-- uncomment + adapt the matching template below.
-- ============================================================================

-- drop policy if exists "admins_can_view_all_trips" on public.trips;
-- create policy "admins_can_view_all_trips"
--   on public.trips for select to authenticated
--   using (public.is_admin());

-- drop policy if exists "admins_can_update_trips" on public.trips;
-- create policy "admins_can_update_trips"
--   on public.trips for update to authenticated
--   using (public.is_admin())
--   with check (public.is_admin());

-- drop policy if exists "admins_can_view_profiles" on public.profiles;
-- create policy "admins_can_view_profiles"
--   on public.profiles for select to authenticated
--   using (public.is_admin() or auth.uid() = id);
