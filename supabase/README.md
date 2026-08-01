# Supabase setup notes

The base schema (tables, RPCs, owner policies) predates version control and
currently lives only in the Supabase dashboard. **Only new SQL is versioned
here.**

## Applying the migration

Option A — dashboard: open **SQL Editor** in your project and paste/run
`migrations/20260801000000_public_tracking.sql`.

Option B — CLI:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

## Verifying anonymous tracking works

1. Create a test trip in the app and note its tracking code.
2. Anonymous REST read (should return a row, not `401`/permission error):

   ```bash
   curl -s "https://<PROJECT_REF>.supabase.co/rest/v1/trips?tracking_code=eq.NYSC-12345&select=tracking_code,status,current_lat,current_lng,last_updated" \
     -H "apikey: <PUBLISHABLE_KEY>" \
     -H "Authorization: Bearer <PUBLISHABLE_KEY>"
   ```

3. Realtime: open `/track?code=NYSC-12345` in an **incognito** window, then
   in the SQL Editor run:

   ```sql
   update public.trips
   set current_lat = 6.5244, current_lng = 3.3792, last_updated = now()
   where tracking_code = 'NYSC-12345';
   ```

   The incognito map should move within a second or two. If the page loads
   but no payloads arrive, check **Database → Replication** that `trips` is
   under `supabase_realtime`.

## Follow-ups worth version-controlling next

- [x] `handle_new_user()` trigger + recursion-safe policy helpers
      (`20260802000000_fix_proposals_rls_and_profiles.sql`) — **required if
      you see `23503` (FK on trips) or `42P17` (policy recursion) errors**
- `check_signal_loss()` and `generate_demo_traffic()` function bodies
- Base table DDL + owner/admin RLS policies (dump from the live project)
- A `trip_tracking_public` view (minimal public columns) + longer codes to
  replace table-level anonymous SELECT

## If trip creation fails with `42P17` / `23503`

1. Run `migrations/20260802000000_fix_proposals_rls_and_profiles.sql` (SQL
   Editor or `supabase db push`). It recreates the profile trigger and
   backfills missing rows.
2. Inspect your remaining policies and rewrite any that self-reference
   `profiles` using `public.is_admin()` (see the templates inside the
   migration):

   ```sql
   select tablename, policyname, cmd, qual, with_check
   from pg_policies
   where schemaname = 'public' and tablename in ('profiles', 'trips');
   ```
3. Promoting a profile to `state_admin`/`school_admin` fails with
   `42703: column "name" does not exist` inside
   `validate_role_jurisdiction()` → run
   `20260802000001_fix_validate_role_jurisdiction.sql` (the function looked up
   `allowed_states.name`; the real columns are `allowed_states.state` and
   `allowed_institutions.name`). `state_admin` jurisdictions must match a
   `allowed_states.state` value; `school_admin` must match an
   `allowed_institutions.name`.
5. Admin dashboard shows traveler name/phone/Emergency Kin as `N/A`/empty →
   admins have no SELECT policy on `profiles`; run
   `20260802000002_admin_read_profiles.sql` (recursion-safe via `is_admin()`).
4. If the migration itself fails with
   `42804: column "role" is of type user_role but expression is of type text`,
   make sure you're running the latest version of the script (it routes every
   role through `safe_user_role()`; re-running is safe — earlier partial runs
   leave the trigger in place and must be overwritten). If casts still fail,
   list your enum labels — the app needs at least `pcm`:

   ```sql
   select t.typname, e.enumlabel
   from pg_enum e join pg_type t on t.oid = e.enumtypid
   where t.typname = 'user_role'
   order by e.enumsortorder;
   ```

