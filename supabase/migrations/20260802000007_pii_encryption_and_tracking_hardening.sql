-- ============================================================================
-- CorperSafe — PII encryption at rest + tracking hardening (2026-08-02, part 7)
--
-- This migration closes the anonymous-read hole documented in
-- 20260801000000_public_tracking.sql and prepares the schema for
-- application-level PII encryption.
--
-- WHAT CHANGES
--   1. profiles gains *_enc columns. Ciphertext is produced by the Next.js
--      server (AES-256-GCM, key in PII_ENCRYPTION_KEY) — Postgres never sees
--      the key, so a database dump or dashboard login shows ciphertext only.
--      The legacy plaintext columns stay for a graceful cutover; run
--      `node scripts/encrypt-existing-pii.mjs` to migrate rows, which nulls
--      the plaintext once the ciphertext is written.
--   2. Tracking codes move to NYSC-XXXXXX (6 chars, unambiguous alphabet,
--      ~1.07 billion combinations) generated in the DB, not the browser.
--   3. Tracking links expire 24h after arrival, with a 30-day backstop for
--      trips never marked complete.
--   4. Anonymous SELECT on trips/profiles is REVOKED. Parents now go through
--      public.track_trip(), a SECURITY DEFINER function that returns a fixed
--      column allow-list for one code and rate-limits lookups.
--
-- NOTE ON REALTIME: with anon SELECT gone, anonymous realtime subscriptions
-- on trips no longer deliver rows (Realtime enforces RLS). The parents'
-- tracker polls track_trip() instead. Authenticated admin dashboards keep
-- realtime via the admin policy below.
--
-- Idempotent: safe to re-run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Encrypted PII columns
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists full_name_enc text;
alter table public.profiles add column if not exists phone_enc text;
alter table public.profiles add column if not exists next_of_kin_enc text;
alter table public.profiles add column if not exists next_of_kin_email_enc text;

comment on column public.profiles.full_name_enc is
  'AES-256-GCM ciphertext (v1:iv:tag:ct). Key lives in the app server env, never in Postgres.';

-- Signup no longer copies PII into profiles: the browser posts it to
-- /api/profile straight after sign-up, which encrypts it server-side. The
-- trigger now only guarantees the row exists (trips.pcm_id FK depends on it).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, role)
  values (new.id, public.safe_user_role(new.raw_user_meta_data ->> 'role'))
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Longer, DB-generated tracking codes
-- ---------------------------------------------------------------------------
-- pgcrypto provides gen_random_bytes (CSPRNG — random() is NOT suitable for
-- security tokens). Supabase installs it into the "extensions" schema;
-- self-hosted projects often use "public". Resolve it once, then build the
-- generator around whichever qualified name actually exists.
do $$
begin
  create extension if not exists pgcrypto with schema extensions;
exception
  when others then
    -- Already installed in another schema, or insufficient privilege — the
    -- lookup below decides what we can actually call.
    null;
end $$;

do $$
declare
  v_schema text;
begin
  select n.nspname into v_schema
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where p.proname = 'gen_random_bytes'
  order by case n.nspname when 'extensions' then 1 when 'public' then 2 else 3 end
  limit 1;

  if v_schema is null then
    raise exception
      'pgcrypto.gen_random_bytes not found. Run: create extension pgcrypto with schema extensions;';
  end if;

  execute format($fn$
    create or replace function public.generate_tracking_code()
    returns text
    language plpgsql
    volatile
    set search_path = ''
    as $inner$
    declare
      alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
      candidate text;
      i int;
    begin
      loop
        candidate := '';
        for i in 1..6 loop
          candidate := candidate || substr(
            alphabet, 1 + (get_byte(%I.gen_random_bytes(1), 0) %% 32), 1
          );
        end loop;
        candidate := 'NYSC-' || candidate;
        exit when not exists (
          select 1 from public.trips where tracking_code = candidate
        );
      end loop;
      return candidate;
    end;
    $inner$;
  $fn$, v_schema);
end $$;

alter table public.trips
  alter column tracking_code set default public.generate_tracking_code();

-- ---------------------------------------------------------------------------
-- 3. Link expiry
-- ---------------------------------------------------------------------------
alter table public.trips add column if not exists tracking_expires_at timestamptz;

comment on column public.trips.tracking_expires_at is
  'Set to arrival + 24h when a trip completes. NULL while the trip is live.';

create or replace function public.set_tracking_expiry()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status in ('completed', 'resolved')
     and (old.status is distinct from new.status)
     and new.tracking_expires_at is null then
    new.tracking_expires_at := now() + interval '24 hours';
  end if;
  return new;
end;
$$;

drop trigger if exists trips_set_tracking_expiry on public.trips;
create trigger trips_set_tracking_expiry
  before update on public.trips
  for each row execute function public.set_tracking_expiry();

-- ---------------------------------------------------------------------------
-- 4. Rate limiting for public lookups
-- ---------------------------------------------------------------------------
create table if not exists public.track_lookups (
  id bigserial primary key,
  client_key text not null,
  looked_up_at timestamptz not null default now()
);

create index if not exists track_lookups_client_time_idx
  on public.track_lookups (client_key, looked_up_at desc);

alter table public.track_lookups enable row level security;
-- No policies: only the SECURITY DEFINER function below touches this table.

-- ---------------------------------------------------------------------------
-- 5. Scoped tracking function (replaces blanket anon SELECT)
-- ---------------------------------------------------------------------------
-- Returns a fixed column allow-list for ONE code. Deliberately omitted:
-- pcm_id, institution, traveler phone, next-of-kin contacts. The traveler's
-- name comes back as ciphertext + legacy plaintext; the API route decrypts.
drop function if exists public.track_trip(text, text);
create or replace function public.track_trip(p_code text, p_client text default 'anonymous')
returns table (
  id uuid,
  tracking_code text,
  status text,
  pause_reason text,
  origin text,
  destination_state text,
  destination_camp text,
  destination_lat double precision,
  destination_lng double precision,
  current_lat double precision,
  current_lng double precision,
  current_speed double precision,
  plate_number text,
  last_updated timestamptz,
  traveler_name text,
  traveler_name_enc text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
  v_recent_minute int;
  v_recent_hour int;
begin
  -- Normalise every way a parent might type it: "8q2k7m", "nysc 8Q2K7M",
  -- "NYSC-8Q2K7M". Mirrors normalizeTrackingCode() in lib/utils.ts.
  v_code := upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g'));
  v_code := regexp_replace(v_code, '^NYSC-?', '');
  v_code := regexp_replace(v_code, '[^A-Z0-9]', '', 'g');
  -- Bound the input: nothing legitimate is longer, and it keeps the index
  -- lookup cheap under a scripted attack.
  if v_code = '' or length(v_code) > 12 then
    raise exception 'invalid_code' using errcode = '22023';
  end if;
  v_code := 'NYSC-' || v_code;

  -- Housekeeping: keep the rate-limit table small.
  delete from public.track_lookups where looked_up_at < now() - interval '2 hours';

  select count(*) into v_recent_minute
    from public.track_lookups
    where client_key = p_client and looked_up_at > now() - interval '1 minute';
  select count(*) into v_recent_hour
    from public.track_lookups
    where client_key = p_client and looked_up_at > now() - interval '1 hour';

  -- 10/min and 100/hour: generous for a worried parent refreshing, useless
  -- for walking the 1.07-billion-code keyspace.
  if v_recent_minute >= 10 or v_recent_hour >= 100 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  insert into public.track_lookups (client_key) values (p_client);

  -- Every column is cast explicitly: RETURNS TABLE raises "structure of query
  -- does not match function result type" on the slightest mismatch (varchar vs
  -- text, numeric vs double precision, timestamp vs timestamptz), and the
  -- underlying column types vary between projects.
  return query
  select
    t.id::uuid,
    t.tracking_code::text,
    t.status::text,
    t.pause_reason::text,
    t.origin::text,
    t.destination_state::text,
    t.destination_camp::text,
    t.destination_lat::double precision,
    t.destination_lng::double precision,
    t.current_lat::double precision,
    t.current_lng::double precision,
    t.current_speed::double precision,
    t.plate_number::text,
    t.last_updated::timestamptz,
    p.full_name::text,
    p.full_name_enc::text
  from public.trips t
  left join public.profiles p on p.id = t.pcm_id
  where t.tracking_code = v_code
    -- Live trips have no expiry; completed ones stay readable for 24h.
    and (t.tracking_expires_at is null or now() < t.tracking_expires_at)
    -- Backstop for trips abandoned without being marked complete.
    and (t.created_at is null or t.created_at > now() - interval '30 days');
end;
$$;

revoke all on function public.track_trip(text, text) from public;
grant execute on function public.track_trip(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Close the anonymous read hole
-- ---------------------------------------------------------------------------
drop policy if exists "public_track_trips" on public.trips;
drop policy if exists "public_track_profiles" on public.profiles;

alter table public.trips enable row level security;
alter table public.profiles enable row level security;

-- Authenticated users keep the access they actually need. These were
-- previously (partly) provided by the blanket policy being dropped above,
-- so they are (re)created explicitly here.
drop policy if exists "trips_select_own_or_admin" on public.trips;
create policy "trips_select_own_or_admin"
  on public.trips for select to authenticated
  using (pcm_id = (select auth.uid()) or public.is_admin());

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

-- admin_read_all_profiles (migration 02) still covers admin reads.

-- Belt and braces: even without a policy, make the table grant explicit.
revoke select on public.trips from anon;
revoke select on public.profiles from anon;

-- ---------------------------------------------------------------------------
-- Verify afterwards
-- ---------------------------------------------------------------------------
--   -- should return exactly one row for a live trip:
--   select * from public.track_trip('NYSC-ABC123', 'test-client');
--   -- should return 0 rows (anon can no longer read the table directly):
--   set role anon; select count(*) from public.trips; reset role;
--   -- confirm the new default:
--   select column_default from information_schema.columns
--     where table_name = 'trips' and column_name = 'tracking_code';
--
-- Rollback:
--   drop trigger if exists trips_set_tracking_expiry on public.trips;
--   drop function if exists public.track_trip(text, text);
--   alter table public.trips alter column tracking_code drop default;
--   -- then re-apply 20260801000000_public_tracking.sql
