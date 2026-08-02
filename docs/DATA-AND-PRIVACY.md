# CorperSafe — Data & Privacy (tester FAQ)

Short answers to the questions testers ask most. Last reviewed: 2026-08-02.

---

## Where is the data hosted?

- **Database, auth and realtime:** [Supabase](https://supabase.com) (managed Postgres running on AWS). The
  region is fixed when the project is created — check **Supabase dashboard → Settings → General → Region**.
  There is no Nigerian AWS region, so the data physically sits outside Nigeria (commonly EU or US).
- **App / web hosting:** Vercel, served over HTTPS at `corpersafe.vercel.app`.
- **SOS emails:** [EmailJS](https://www.emailjs.com) — the next-of-kin address and traveler name pass
  through their service to send the alert.
- **Maps:** map tiles come from OpenStreetMap / CARTO, and camp names are geocoded once via OSM Nominatim.
  Tile and geocode requests reach those providers, but **no traveler identity is attached** to them.
- **On your phone:** GPS points recorded while you're offline sit in `localStorage` until they sync,
  and your login session is stored in the browser. Logging out and clearing site data removes both.

## Is the data encrypted?

Yes — on both legs, and it's on by default rather than something we had to switch on:

- **In transit:** every connection is HTTPS/TLS 1.2+ — browser → Vercel, browser → Supabase, and the
  realtime websocket that streams the map. Supabase enforces TLS on all connections.
- **At rest:** Supabase encrypts all database files, indexes, WAL and backups with **AES-256** at the
  storage layer. It's provided by the underlying cloud infrastructure and cannot be disabled.
- **Passwords:** never stored by us in any readable form — Supabase Auth holds a salted hash, and the
  app never sees it.

**What is _not_ encrypted:** individual columns are not separately encrypted inside the database
(no field-level/application-level encryption). So your name, phone, next-of-kin details and GPS trail
are readable to anyone with legitimate database access — the operator of this project, and Supabase
as the infrastructure provider. That's normal for an app at this stage, but it's the honest limit of
"it's encrypted."

## Who can see my location?

- **Anyone holding your Tracking ID.** The `/track` page is deliberately login-free so parents don't
  need an account — which means the code is the only thing protecting the view. Treat it like a
  password and only send it to people you want watching.
- **Admins** (state coordinators / school admins) see active trips on the Mission Control dashboard,
  including your name, phone, plate number and next-of-kin contact when an SOS fires.
- **Tracking stops when the trip ends.** Once you tap *Arrived*, the trip is marked completed and is no
  longer readable from the public tracker — it only remains in your own History.

## What is collected?

| Data | Why | When |
|---|---|---|
| Name, email, phone | account + who admins are looking at | signup |
| Next-of-kin phone & email | who gets the SOS alert | signup / trip registration |
| Institution, destination camp, origin | routing and admin jurisdiction | trip registration |
| Vehicle plate number | helps responders identify the vehicle | at boarding (optional) |
| GPS position, speed, timestamps | the live map and route replay | only while a trip is active |

GPS is captured **only during an active trip** — not in the background, not after you arrive, and not
before you tap START JOURNEY.

---

## Known limitation we're fixing

⚠️ **This is a pilot build. Please don't test with data you'd be upset to see leak — use a spare
email, and treat any trip you register as public.**

Encryption is handled, but there's a real access-control gap that matters more:

- Tracking codes are **`NYSC-` + 5 digits — only 90,000 possibilities**, which is guessable at scale.
- More importantly, the row-level security policy that lets parents read without an account currently
  grants the anonymous role read access to **every non-completed trip**, not just the one matching the
  code that was typed. The public API key that ships in the browser is enough to list live trips and
  the joined traveler profile (name, phone, next of kin).

This is flagged in the migration's own security notes. The hardening path:

1. Replace the blanket anonymous table read with a `security definer` RPC that takes a tracking code and
   returns **only** the columns the tracker screen renders.
2. Restrict the anonymous role to a safe column list so the profile join can't leak contact details.
3. Lengthen and randomise tracking codes, and add expiry so a shared link dies with the trip.
4. Add rate limiting on lookups to blunt enumeration.

Until that lands, assume a determined person could enumerate live trips.
