-- ============================================================================
-- CorperSafe — user_role: remove "group" from public.profiles.role
-- (2026-08-02, part 5b — rewritten)
--
-- Finishes what …04 started, operating on the enum type that backs the
-- `role` COLUMN of public.profiles (name-agnostic — "user_role" or
-- "user_roles"):
--
--   1. Promotes any remaining legacy rows to super_admin:
--        'group'       -> 'super_admin'
--        'super admin' -> 'super_admin'
--   2. Physically removes the legacy labels from the enum.
--
-- PostgreSQL has NO "ALTER TYPE ... DROP VALUE", so when 'group' and
-- 'super_admin' already exist side-by-side the type is REBUILT: a clean
-- temporary enum is created (current labels minus 'group'/'super admin'),
-- the profiles.role column is moved onto it, safe_user_role() is repointed,
-- and the old type is dropped — leaving no trace of the legacy labels.
-- When …04 already renamed 'group' -> 'super_admin', this file is a no-op.
--
-- Run AFTER 20260802000004_user_role_add_super_admin.sql.
-- Idempotent: safe to re-run at any time.
-- ============================================================================

do $$
declare
  enum_oid oid;
  enum_type name;
  tmp_type text := 'user_role_clean';
  label_arr text[];
  label_list text;
  other_deps int;
  has_default int;
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

  -- 1. Promote legacy rows (guarded: the literal comparisons are only valid
  --    while the labels still exist in the enum).
  if exists (select 1 from pg_enum where enumtypid = enum_oid and enumlabel = 'group') then
    if exists (select 1 from pg_enum where enumtypid = enum_oid and enumlabel = 'super_admin') then
      execute 'update public.profiles set role = ''super_admin'' where role = ''group''';
    else
      -- Shouldn't happen after …04, but renaming is the safe conversion.
      execute format('alter type public.%I rename value ''group'' to ''super_admin''', enum_type);
    end if;
  end if;

  if exists (select 1 from pg_enum where enumtypid = enum_oid and enumlabel = 'super admin')
     and exists (select 1 from pg_enum where enumtypid = enum_oid and enumlabel = 'super_admin')
  then
    execute 'update public.profiles set role = ''super_admin'' where role = ''super admin''';
  end if;

  -- 2. No legacy labels left? Nothing to remove.
  if not exists (
    select 1 from pg_enum where enumtypid = enum_oid and enumlabel in ('group', 'super admin')
  ) then
    return;
  end if;

  -- 3. Rebuild the enum without the legacy labels. Skip if any OTHER
  --    column still uses the old type (would break the drop).
  select count(*) into other_deps
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  where a.atttypid = enum_oid
    and not a.attisdropped
    and not (n.nspname = 'public' and c.relname = 'profiles' and a.attname = 'role');

  if other_deps > 0 then
    raise notice 'Other columns still use enum % — rebuild skipped; legacy labels remain but are inert.', enum_type;
    return;
  end if;

  -- A column default would fail to cast across the type swap — drop it now
  -- and restore the sensible 'pcm' default afterwards if one existed.
  select count(*) into has_default
  from pg_attrdef d
  join pg_attribute a on a.attrelid = d.adrelid and a.attnum = d.adnum
  where a.attrelid = 'public.profiles'::regclass
    and a.attname = 'role'
    and not a.attisdropped;

  if has_default > 0 then
    execute 'alter table public.profiles alter column role drop default';
  end if;

  -- Clean label list: current labels minus the legacy ones, with
  -- super_admin guaranteed present.
  select coalesce(array_agg(e.enumlabel order by e.enumsortorder), '{}'::text[])
    into label_arr
  from pg_enum e
  where e.enumtypid = enum_oid
    and e.enumlabel not in ('group', 'super admin');

  if not ('super_admin' = any(label_arr)) then
    label_arr := array_append(label_arr, 'super_admin');
  end if;

  label_list := (
    select string_agg(quote_literal(l), ', ' order by ord)
    from unnest(label_arr) with ordinality as u(l, ord)
  );

  -- a. Create the clean temporary enum.
  execute format('drop type if exists public.%I', tmp_type);
  execute format('create type public.%I as enum (%s)', tmp_type, label_list);

  -- b. Move the column onto it (enum -> text -> clean enum cast).
  execute format(
    'alter table public.profiles alter column role type public.%I using role::text::public.%I',
    tmp_type,
    tmp_type,
  );

  -- c. Repoint safe_user_role() at the clean type (drop first —
  --    CREATE OR REPLACE cannot change a function's return type).
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
  $fn$, tmp_type, tmp_type, tmp_type);

  -- d. Drop the old type and adopt the clean one under the original name.
  execute format('drop type public.%I', enum_type);
  execute format('alter type public.%I rename to %I', tmp_type, enum_type);

  -- e. Restore a role default if there was one ('pcm' is the only sensible
  --    default for the role column — signups always pass it explicitly).
  if has_default > 0 then
    execute format('alter table public.profiles alter column role set default ''pcm''::public.%I', enum_type);
  end if;
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
--
--   select role, count(*) from public.profiles group by role order by role;
