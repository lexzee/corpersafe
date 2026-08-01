-- ============================================================================
-- CorperSafe — user_role: ensure "super_admin" exists (2026-08-02, part 5a)
--
-- The app already treats super_admin as the top role (monitors ALL trips —
-- no jurisdiction filter). This step guarantees the enum label exists so the
-- next migration (…05_user_role_drop_group.sql) can migrate "group" users
-- onto it and drop the legacy label.
--
-- ALTER TYPE … ADD VALUE cannot be USED in the same transaction it is added,
-- so the add lives here and the data migration + drop live in …05.
-- Idempotent: safe to re-run.
-- ============================================================================

do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'user_role'
      and e.enumlabel = 'super_admin'
  ) then
    execute 'alter type public.user_role add value ''super_admin''';
  end if;
end $$;

-- Verify:
--   select t.typname, e.enumlabel
--   from pg_enum e join pg_type t on t.oid = e.enumtypid
--   where t.typname = 'user_role' order by e.enumsortorder;
