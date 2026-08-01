-- ============================================================================
-- CorperSafe — user_role: drop "group", migrate users to super_admin
-- (2026-08-02, part 5b)
--
-- Legacy "group" accounts become super admins (monitor all trips — no
-- jurisdiction filter, per the app's is_admin()/AdminContent logic). Rows
-- holding a 'super admin' (space) label, if any, are also normalized to
-- 'super_admin'. The 'group' label is then removed from the enum.
--
-- Run AFTER 20260802000004_user_role_add_super_admin.sql.
-- Idempotent: safe to re-run (the data updates and drops are guarded with
-- pg_enum existence checks, so a second run is a no-op).
-- ============================================================================

-- 1. Convert legacy rows (guarded: comparing an enum column to a literal
--    that no longer exists would error, so only run when the label exists).
do $$
begin
  if exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'user_role' and e.enumlabel = 'group'
  ) then
    execute 'update public.profiles set role = ''super_admin'' where role = ''group''';
  end if;

  if exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'user_role' and e.enumlabel = 'super admin'
  ) then
    execute 'update public.profiles set role = ''super_admin'' where role = ''super admin''';
  end if;
end $$;

-- 2. Drop the legacy labels ----------------------------------------------------
alter type public.user_role drop value if exists 'group';
alter type public.user_role drop value if exists 'super admin';

-- Verify:
--   select role, count(*) from public.profiles group by role order by role;
--   select e.enumlabel from pg_enum e
--   join pg_type t on t.oid = e.enumtypid
--   where t.typname = 'user_role' order by e.enumsortorder;
