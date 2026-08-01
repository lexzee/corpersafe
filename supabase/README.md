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

- `check_signal_loss()` and `generate_demo_traffic()` function bodies
- Base table DDL + owner/admin RLS policies (dump from the live project)
- A `trip_tracking_public` view (minimal public columns) + longer codes to
  replace table-level anonymous SELECT
