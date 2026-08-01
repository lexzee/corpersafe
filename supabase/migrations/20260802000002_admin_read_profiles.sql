-- ============================================================================
-- CorperSafe — admins can read traveler profiles (2026-08-02, part 3)
--
-- Symptom: Mission Control trip cards / Trip Details show "N/A" for the
-- traveler name, phone, and Emergency Kin even though the PCM filled them in
-- during trip registration.
--
-- Cause: with RLS on public.profiles and no admin SELECT policy, the embedded
-- join in trips queries ( select("*, profiles(...)") ) silently resolves to
-- NULL for every row that isn't the admin's own. Emergency Kin + phone are
-- exactly the details an admin needs when an SOS fires.
--
-- Recursion-safe: public.is_admin() is SECURITY DEFINER
-- (20260802000000_fix_proposals_rls_and_profiles.sql), so this policy never
-- sub-selects profiles directly from a profiles policy.
-- Idempotent: safe to re-run.
-- ============================================================================

drop policy if exists "admin_read_all_profiles" on public.profiles;
create policy "admin_read_all_profiles"
  on public.profiles for select to authenticated
  using (public.is_admin() or auth.uid() = id);

-- Verify afterwards:
--   select id, full_name, next_of_kin from public.profiles limit 5;
-- (run as an admin user — rows other than your own should be visible)
