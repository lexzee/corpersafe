# 🛡️ CorperSafe

**Travel to camp, arrive safely.** CorperSafe is a travel-safety companion for Nigerian **NYSC corps members (PCMs)** travelling to orientation camps. A traveler registers their trip, shares a tracking link with family, is GPS-tracked live from their own phone, and can raise an SOS in emergencies — while state coordinators, school admins, and security personnel monitor every journey from a Mission Control dashboard.

> ⚠️ **Disclaimer:** CorperSafe is independently developed and is **not affiliated with the NYSC Directorate**.

---

## How it works

```
PCM registers trip ──► shares NYSC-XXXXXX code with family ──► START JOURNEY
        │                                                        │
        ▼                                                        ▼
Admins see trip on Mission Control ◄── live GPS (watchPosition) ── phone
        │                                                        │
   SOS button ──► status=danger ──► email to next-of-kin + alarm on admin map
```

### Roles

| Role | Access | Key screens |
|---|---|---|
| **PCM** (traveler) | Sign up (default role) | Register trip, live tracking view, SOS, trip history, profile |
| **Parent / Guardian** | **No account needed** | `/track?code=...` live map with plain-language status |
| **Admin** (`state_admin`, `school_admin`, `admin`, `super_admin`) | Set `profiles.role` in DB | Dashboard + Mission Control: live map of all trips, SOS alarm, acknowledge/resolve incidents, dead-man's-switch signal scan |

> **Roles live in the `role` column of `public.profiles`** (an enum — shown as `user_role`/`user_roles` under the column, **not** a standalone table). `super_admin` monitors **all** trips (no jurisdiction filter — shows "National Control Center"). Apply `20260802000004_user_role_add_super_admin.sql` + `20260802000005_user_role_drop_group.sql` (in order) to guarantee the `super_admin` label exists and to **remove the legacy `group` role** — existing `group` accounts are promoted to `super_admin`. The migrations resolve the enum type from the column definition, so they work whatever the type is named. Note: PostgreSQL cannot `DROP VALUE` from an enum, so when `group` and `super_admin` already exist side-by-side, migration 05 rebuilds the type to physically remove `group`.

## Feature highlights

- **Trip registration** with GPS-detected origin (OSM Nominatim reverse geocode), DB-backed camp/institution pickers, and next-of-kin contacts.
- **Live tracking** via `watchPosition` with speed calculation, auto-pause after 5 min stopped (< 5 km/h) and auto-resume (> 10 km/h), with one-tap override.
- **Planned routes everywhere:** the destination is pinned and a route line connects it to the traveler (origin → destination on Mission Control and the parents' tracker, live position → destination on the traveler's map) with a distance-to-camp readout. Camp coordinates are geocoded via free OSM Nominatim (cached) with built-in per-state centroids as the offline fallback — no paid routing/geocoding APIs.
- **Resilient by design:** screen wake-lock, offline GPS queue in `localStorage` (synced on reconnect), low-battery & connection warnings.
- **SOS:** hold-3s activation with haptics → 5s undo window → status `danger` + next-of-kin email (EmailJS) + admin alarm. False alarms can be cancelled; admins run a `danger → responding → resolved` incident workflow with an audit trail.
- **Parents' tracker** (`/track`): no login, realtime updates, stale-signal reassurance copy.
- **PWA:** installable, branded offline page, network-first service worker.

## Tech stack

Next.js (App Router) · React 19 · TypeScript · Tailwind + shadcn/ui-style components · Supabase (Auth, Postgres, Realtime, RPC) · Leaflet/react-leaflet (OSM + CARTO tiles) · EmailJS

## Getting started

### 1. Supabase project

Create a project at [database.new](https://database.new). You'll need these tables (the app was built against them):

| Table | Purpose |
|---|---|
| `profiles` | `full_name`, `phone`, `role`, `jurisdiction`, `next_of_kin`, `next_of_kin_email` |
| `trips` | journey rows: `pcm_id`, `origin`, `destination_state/camp`, `institution`, `status`, `tracking_code`, `plate_number`, `current_lat/lng`, `current_speed`, `last_updated`, `is_demo` (demo-cleanup migration), `destination_lat/lng` (precise camp coordinates, stored at registration by `20260802000006_trips_destination_coords.sql`) |
| `trip_logs` | GPS breadcrumb history (route replay) |
| `alert_logs` | SOS email + admin action audit trail |
| `allowed_states` / `allowed_institutions` | camp & school pickers |
| `vehicles` | *(legacy)* plate registry — verification feature currently removed from the app |

Plus the RPC functions `check_signal_loss()` (dead-man's-switch scan), `generate_demo_traffic(admin_id)` (demo data) and `delete_demo_traffic()` (removes demo trips — added by the demo-cleanup migration, see below).

> **Demo cleanup migration** — apply `20260802000003_demo_trips_cleanup.sql` to add the `trips.is_demo` flag and the `delete_demo_traffic()` RPC. It lets admins **stop the demo and delete the fake trips from the UI** (the Mission Control "Simulate" button becomes "Stop Demo" while demo trips exist) instead of cleaning up in the Supabase dashboard. The delete matches `is_demo` or the demo fingerprint (`plate_number` starting with `DEMO`, `origin`/`institution` containing `demo`); adjust the SQL if your generator differs.

### 2. Anonymous public tracking (required for `/track`)

Parents track **without accounts**, so the `anon` role needs read access. Apply the migration in [`supabase/migrations/`](supabase/migrations) (SQL Editor or `supabase db push`) — it adds scoped RLS policies and puts `trips` in the realtime publication. See [`supabase/README.md`](supabase/README.md) for details and verification steps.

### 3. Auth configuration

Email confirmation is disabled in Supabase, so new PCMs are signed in immediately
and redirected to their dashboard after registration. Password-reset emails still use Supabase's default templates
(`{{ .ConfirmationURL }}`) and return users to `/auth/update-password`.

Add the app URL to **Authentication → URL Configuration → Redirect URLs** in the
Supabase dashboard.

### 4. Environment variables

Copy `.env.example` → `.env.local`:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | publishable/anon key |
| `NEXT_PUBLIC_EMAILJS_SERVICE_ID` / `_TEMPLATE_ID` / `_PUBLIC_KEY` | EmailJS credentials for SOS emails (all **must** be `NEXT_PUBLIC_` — they run in the browser) |
| `NEXT_PUBLIC_EMAILJS_REPLY_TO` | *(optional)* reply-to shown in SOS emails |

### 5. Run

```bash
npm ci
npm run dev    # http://localhost:3000
```

### 6. Make someone an admin

```sql
update public.profiles set role = 'state_admin', jurisdiction = 'Lagos'
where id = '<user-uuid>';
```

## Project structure

```
app/
  page.tsx                  Landing
  track/                    Public parents' tracker (no auth)
  auth/                     Supabase auth flows
  (protected)/
    register-trip/          Trip registration form
    (dashboard)/pcm/        Traveler dashboard + live tracking view
    (dashboard)/admin/      Admin dashboard + Mission Control
    history/                Completed trips + route replay
    profile/                Profile & next-of-kin editor
components/                 UI, panic button, map views, sidebar, toaster
lib/
  supabase/                 client/server/proxy Supabase helpers
  utils.ts                  shared helpers (status, distance, safety check)
  email.ts                  EmailJS SOS sender
  toast.ts                  global toasts · offline-queue.ts GPS buffer
public/sw.js + offline.html Service worker & offline page
app/manifest.ts             PWA manifest
```

## Roadmap / known gaps

- SMS/WhatsApp alerts to next-of-kin (email-only today — Termii/Twilio planned)
- TTL job to auto-close abandoned "active" trips
- Longer, less enumerable tracking codes (+ view/RPC-based public lookup to replace table-level anon SELECT)
- `npm run lint` has pre-existing style debt (mostly `no-explicit-any`)
- Base DB schema predates migrations — only new SQL is versioned in `supabase/migrations`
