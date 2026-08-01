-- ============================================================================
-- Fix: missing profile rows (FK 23503 on trips) + profiles RLS infinite
-- recursion (42P17)
--
-- Background: the base schema (tables, triggers, most RLS policies) was
-- originally created in the dashboard and is not versioned. On a fresh or
-- rebuilt project this leaves two failures:
--
--   1. No handle_new_user trigger -> new signups never get a profiles row
--      -> every trip insert violates trips_pcm_id_fkey (409 / 23503).
--   2. Some profiles policy queries `profiles` again (directly, or via
--      trips policies that look up profiles) -> Postgres reports
--      "infinite recursion detected in policy" (500 / 42P17) on ANY
--      read/update of profiles.
--
-- This migration recreates the trigger, backfills missing rows, adds the
-- insert policy the app's fallback uses, and provides recursion-safe
-- helpers + rewrite templates for the self-referencing policies.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. Every auth user must get a profiles row (trips.pcm_id needs it)
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'phone', ''),
    coalesce(new.raw_user_meta_data ->> 'role', 'pcm')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill users who signed up while the trigger was missing
insert into public.profiles (id, full_name, phone, role)
select
  u.id,
  coalesce(u.raw_user_meta_data ->> 'full_name', ''),
  coalesce(u.raw_user_meta_data ->> 'phone', ''),
  coalesce(u.raw_user_meta_data ->> 'role', 'pcm')
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;

-- Let an authenticated user create/repair their OWN profile row (the
-- register-trip form uses this as a self-healing fallback)
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id);


-- ---------------------------------------------------------------------------
-- 2. Recursion-safe "am I an admin?" check
--
--    A policy like
--      using (exists (select 1 from profiles where id = auth.uid() and ...))
--    recurses because evaluating profiles' policy requires evaluating
--    profiles' policies again. A SECURITY DEFINER function bypasses inner
--    RLS, so it cannot recurse. Rewrite your self-referencing policies to
--    use this function instead.
--
--    Inspect what you actually have first:
--      select policyname, cmd, qual, with_check
--      from pg_policies
--      where schemaname = 'public' and tablename = 'profiles';
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('admin', 'super_admin', 'state_admin', 'school_admin')
  );
$$;

-- Rewrite templates (adjust names to match your pg_policies output):
--
--   drop policy if exists "Admins can manage profiles" on public.profiles;
--   create policy "Admins can manage profiles"
--     on public.profiles for all to authenticated
--     using  ( id = auth.uid() or public.is_admin() )
--     with check ( id = auth.uid() );
--
-- Anti-pattern to remove, wherever it appears (profiles or trips policies):
--   exists (select 1 from profiles where ...)


-- ---------------------------------------------------------------------------
-- 3. Harden anonymous tracking against cross-table recursion cycles
--    (profiles policy -> trips -> trips policy -> profiles), same technique
-- ---------------------------------------------------------------------------
create or replace function public.has_live_trip(profile_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.trips t
    where t.pcm_id = profile_id
      and t.status not in ('completed', 'resolved')
  );
$$;

drop policy if exists "public_track_profiles" on public.profiles;
create policy "public_track_profiles"
  on public.profiles
  for select
  to anon, authenticated
  using (public.has_live_trip(profiles.id));

-- The trips-side public policy has no cross-table references and is safe
-- as-is (see 20260801000000_public_tracking.sql).
