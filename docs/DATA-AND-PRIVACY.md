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

- **In transit:** every connection is HTTPS/TLS 1.2+ — browser → Vercel and browser → Supabase.
  Supabase enforces TLS on all connections.
- **At rest:** Supabase encrypts all database files, indexes, WAL and backups with **AES-256** at the
  storage layer. It's provided by the underlying cloud infrastructure and cannot be disabled.
- **Passwords:** never stored by us in any readable form — Supabase Auth holds a salted hash, and the
  app never sees it.
- **Personal details, additionally:** name, phone, next of kin and their email are encrypted a
  second time by the application (**AES-256-GCM**) *before* they reach Postgres. A database dump or
  a Supabase dashboard login shows ciphertext like `v1:vBjz…` — not the value. They are decrypted
  only in the app server, only when a screen needs them.

**The honest limit:** the decryption key lives in the app's server environment, so whoever
administers the Vercel project can still decrypt. This protects against a database leak, a stolen
backup or a compromised DB credential — not against the operator. Making it unreadable to the
operator too would mean deriving keys from each user's password, which would stop admins from
seeing who to help during an SOS.

**Not encrypted at the column level:** GPS coordinates and trip details (origin, destination, plate
number), because admins and the map need to query them directly.

## Who can see my location?

- **Anyone holding your Tracking ID.** The `/track` page is deliberately login-free so parents don't
  need an account — which means the code is the only thing protecting the view. Treat it like a
  password and only send it to people you want watching. That page shows your **first name, route
  and live position only** — never your phone number or your next of kin's.
- **Admins** (state coordinators / school admins) see active trips on the Mission Control dashboard,
  including your name, phone, plate number and next-of-kin contact when an SOS fires.
- **Tracking stops when the trip ends.** Once you tap *Arrived*, the link keeps working for 24 hours
  (so a late-opened message still resolves) and then stops. The trip remains in your own History.

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

## Security hardening (applied)

⚠️ **This is a pilot build. Please don't test with data you'd be upset to see leak — use a spare
email, and treat any trip you register as public.**

The gap described in earlier versions of this document (anonymous read access to every live trip)
has now been closed. As of migration `20260802000007`:

1. **Scoped access** — the anonymous role can no longer read `trips` or `profiles` at all. Parents go
   through `public.track_trip()`, which returns a fixed column allow-list for **one** code.
2. **Column allow-list** — the tracker returns the traveler's **first name only**. Phone numbers and
   next-of-kin contacts are never sent to that page.
3. **Longer codes with expiry** — codes moved from `NYSC-#####` (90,000 combinations) to
   `NYSC-XXXXXX` from a 32-character unambiguous alphabet: **1,073,741,824 combinations**, generated
   by a cryptographic RNG in the database. Links stop working 24 hours after arrival, with a 30-day
   backstop for trips never marked complete.
4. **Rate limiting** — 10 lookups/minute and 100/hour per IP, so the keyspace can't be walked.

Remaining trade-offs are documented in [`SECURITY-DEPLOYMENT.md`](SECURITY-DEPLOYMENT.md): the
tracker polls every 15s instead of using realtime websockets, and rate limits are per-IP so users
behind one mobile-carrier NAT share a bucket.
