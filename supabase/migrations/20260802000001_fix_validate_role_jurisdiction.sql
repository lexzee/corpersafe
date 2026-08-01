-- ============================================================================
-- CorperSafe — fix validate_role_jurisdiction() (2026-08-02, part 2)
--
-- Live failure when promoting a profile to a scoped admin role:
--   42703: column "name" does not exist
--   QUERY:  not exists (select 1 from public.allowed_states where name = new.jurisdiction)
--   CONTEXT: PL/pgSQL function validate_role_jurisdiction() line 5 at IF
--
-- Cause: the trigger function looked up allowed_states.name, but the real
-- columns are allowed_states(state, campName). Scoped roles now validate
-- against the correct table/column:
--   state_admin  -> jurisdiction must exist in allowed_states.state
--   school_admin -> jurisdiction must exist in allowed_institutions.name
-- All other roles (pcm, admin, super_admin) carry no jurisdiction rule.
--
-- CREATE OR REPLACE keeps the existing trigger binding intact — only the
-- broken body is swapped.
-- ============================================================================

create or replace function public.validate_role_jurisdiction()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.role::text = 'state_admin' then
    if new.jurisdiction is null or btrim(new.jurisdiction) = ''
       or not exists (
         select 1 from public.allowed_states s
         where s.state = btrim(new.jurisdiction)
       ) then
      raise exception
        'state_admin requires a jurisdiction matching an allowed_states.state value (got "%")',
        new.jurisdiction;
    end if;
  elsif new.role::text = 'school_admin' then
    if new.jurisdiction is null or btrim(new.jurisdiction) = ''
       or not exists (
         select 1 from public.allowed_institutions i
         where i.name = btrim(new.jurisdiction)
       ) then
      raise exception
        'school_admin requires a jurisdiction matching an allowed_institutions.name value (got "%")',
        new.jurisdiction;
    end if;
  end if;
  return new;
end;
$$;

-- Sanity checks ---------------------------------------------------------------
--   -- valid jurisdiction values for each scoped role:
--   select state from public.allowed_states order by state;
--   select name from public.allowed_institutions order by name;
--
--   -- typical promote statements:
--   update public.profiles set role = 'state_admin', jurisdiction = 'Lagos'
--   where id = '<user-uuid>';
--   update public.profiles set role = 'school_admin',
--     jurisdiction = 'University of Nigeria, Nsukka'
--   where id = '<user-uuid>';
-- ----------------------------------------------------------------------------
