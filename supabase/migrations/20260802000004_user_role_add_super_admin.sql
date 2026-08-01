-- ============================================================================
-- CorperSafe — roles: guarantee "super_admin" on public.profiles.role
-- (2026-08-02, part 5a — rewritten)
--
-- The roles are NOT a standalone table: they live in the `role` COLUMN of
-- public.profiles, backed by an enum type. In the Supabase dashboard this
-- shows up as "user_role"/"user_roles" under that column. This migration
-- resolves the ACTUAL enum type from the column definition (whatever it is
-- named) and:
--
--   1. normalizes a 'super admin' (space) label to 'super_admin'
--   2. guarantees 'super_admin' exists — converting the legacy 'group'
--      label directly when possible via ALTER TYPE ... RENAME VALUE, which
--      removes 'group' and promotes its holders in one atomic step
--   3. recreates safe_user_role() against the resolved type name so signup
--      metadata casting keeps working under either type name
--
-- ALTER TYPE ... ADD VALUE cannot be USED in the same transaction it is
-- added, so any ADD lives here and usage (data migration + cleanup) lives
-- in …05_user_role_drop_group.sql.
--
-- PostgreSQL has no DROP VALUE for enums. When 'group' and 'super_admin'
-- already exist side-by-side, removing 'group' means rebuilding the enum
-- type — that is done in …05.
--
-- Idempotent: safe to re-run at any time.
-- ============================================================================

do $$
declare
  enum_oid oid;
  enum_type name;
begin
  -- Resolve the enum type backing public.profiles.role (name-agnostic).
  select t.oid, t.typname into enum_oid, enum_type
  from pg_type t
  join pg_attribute a on a.atttypid = t.oid
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'profiles'
    and a.attname = 'role'
    and t.typtype = 'e'
  limit 1;

  if enum_oid is null then
    raise notice 'public.profiles.role is not backed by an enum type — nothing to do.';
    return;
  end if;

  -- 1. Normalize 'super admin' (space) -> 'super_admin' when the target
  --    label isn't taken yet.
  if exists (select 1 from pg_enum where enumtypid = enum_oid and enumlabel = 'super admin')
     and not exists (select 1 from pg_enum where enumtypid = enum_oid and enumlabel = 'super_admin')
  then
    execute format('alter type public.%I rename value ''super admin'' to ''super_admin''', enum_type);
  end if;

  -- 2. Ensure super_admin exists. If the legacy 'group' label is still
  --    present, renaming it to 'super_admin' both removes 'group' and
  --    promotes its holders — no data update or rebuild needed later.
  if not exists (select 1 from pg_enum where enumtypid = enum_oid and enumlabel = 'super_admin') then
    if exists (select 1 from pg_enum where enumtypid = enum_oid and enumlabel = 'group') then
      execute format('alter type public.%I rename value ''group'' to ''super_admin''', enum_type);
    else
      execute format('alter type public.%I add value ''super_admin''', enum_type);
    end if;
  end if;

  -- 3. Recreate safe_user_role() against the resolved type name. The base
  --    schema predates version control, so the old function may reference a
  --    hardcoded 'user_role' that doesn't exist under a different name.
  drop function if exists public.safe_user_role(text);
  execute format($fn$
    create function public.safe_user_role(p text)
    returns public.%I
    language plpgsql
    set search_path = ''
    as $body$
    begin
      return coalesce(nullif(p, ''), 'pcm')::public.%I;
    exception
      when invalid_text_representation then
        return 'pcm'::public.%I;
    end;
    $body$;
  $fn$, enum_type, enum_type, enum_type);
end $$;

-- Verify (name-agnostic — works for "user_role" or "user_roles"):
--   select t.typname, e.enumlabel
--   from pg_enum e
--   join pg_type t on t.oid = e.enumtypid
--   join pg_attribute a on a.atttypid = t.oid
--   join pg_class c on c.oid = a.attrelid
--   join pg_namespace n on n.oid = c.relnamespace
--   where n.nspname = 'public' and c.relname = 'profiles' and a.attname = 'role'
--   order by e.enumsortorder;
