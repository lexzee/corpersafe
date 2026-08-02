# Deploying the PII encryption + tracking hardening

⚠️ **Order matters.** Applying the SQL before the env vars are live will break
signup and the parents' tracker. Follow these steps top to bottom.

---

## 1. Generate and store the encryption key

```bash
openssl rand -base64 32
```

Add to **Vercel → Project → Settings → Environment Variables** (all environments):

| Variable | Value | Notes |
|---|---|---|
| `PII_ENCRYPTION_KEY` | the string above | **Server only** — no `NEXT_PUBLIC_` prefix |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → `service_role` | **Server only** |

> 🔑 **Back up `PII_ENCRYPTION_KEY` somewhere safe (password manager).**
> Lose it and every encrypted name, phone and next-of-kin contact is
> unrecoverable — there is no reset. Rotating it means decrypting every row
> with the old key and re-encrypting with the new one.

### Can I just type a random value?

You can — but don't. `PII_ENCRYPTION_KEY` accepts three forms:

| What you paste | Result |
|---|---|
| `openssl rand -base64 32` output (44 chars ending `=`) | ✅ used directly — full 256-bit strength |
| 64 hex characters | ✅ used directly — full 256-bit strength |
| anything else, e.g. `corpersafe2026` | ⚠️ accepted, but SHA-256'd into a key — only as strong as the phrase you typed |

That last row is a convenience fallback so a typo doesn't crash the app. A
guessable passphrase means a leaked database could be brute-forced offline,
which defeats the point. **Use the `openssl` output.**

No account, service or signup is needed — the key is just 32 random bytes you
generate yourself. If you're not on a machine with `openssl`, this works too:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## 2. Deploy the app code first

The new code reads *both* encrypted and legacy plaintext columns, so it runs
fine against the old schema. Deploying it first means there's no window where
the DB has changed but the app hasn't.

```bash
git push origin arena/019fc23b-corpersafe   # then promote in Vercel
```

## 3. Apply the migration

Supabase dashboard → SQL Editor → paste and run:

```
supabase/migrations/20260802000007_pii_encryption_and_tracking_hardening.sql
```

Or `supabase db push` if you use the CLI.

## 4. Backfill existing rows

Encrypts the plaintext already in `profiles` and nulls the plaintext columns.

```bash
NEXT_PUBLIC_SUPABASE_URL="https://<project>.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="<service-role-key>" \
PII_ENCRYPTION_KEY="<your-key>" \
node scripts/encrypt-existing-pii.mjs --dry-run   # preview

# then for real
node scripts/encrypt-existing-pii.mjs
```

Idempotent — safe to re-run.

## 5. Verify

```sql
-- 1. PII is ciphertext (should look like v1:xxx:yyy:zzz)
select id, full_name, full_name_enc from public.profiles limit 3;

-- 2. Anonymous role can no longer read the tables
set role anon;
select count(*) from public.trips;      -- expect 0 rows / permission denied
select count(*) from public.profiles;   -- expect 0 rows / permission denied
reset role;

-- 3. The scoped function still works
select * from public.track_trip('NYSC-XXXXXX', 'verify');

-- 4. New codes are 6 characters
select column_default from information_schema.columns
 where table_name = 'trips' and column_name = 'tracking_code';
```

In the browser: register a trip, open `/track` in a private window with the
code, confirm the map moves, then confirm an SOS still emails next of kin.

## 6. Drop the legacy columns (optional, after a week of clean running)

```sql
alter table public.profiles
  drop column full_name,
  drop column phone,
  drop column next_of_kin,
  drop column next_of_kin_email;
```

Only do this once you're confident — the fallback path disappears with them.

---

## What changed, in one table

| Area | Before | After |
|---|---|---|
| Profile PII | plaintext in Postgres | AES-256-GCM ciphertext, key in app env |
| Signup PII | copied into `auth.users.raw_user_meta_data` | role only; PII posted to `/api/profile` |
| Tracking codes | `NYSC-#####`, 90k combos, generated in browser | `NYSC-XXXXXX`, 1.07bn combos, CSPRNG in DB |
| Anonymous reads | every non-completed trip + joined profile | `track_trip()` only: one code, fixed columns |
| Data on the tracker | full name, phone, next-of-kin phone | first name only; no contact details |
| Link lifetime | forever | dies 24h after arrival; 30-day backstop |
| Lookup limits | none | 10/min, 100/hour per IP |
| Admin feed | direct table read, filtered in browser | `/api/admin/trips`, role + jurisdiction enforced server-side |

## FAQ

**Do I need to re-run the migration after every signup?**

No. A migration is a one-time change to the *shape* of the database, not a
data-processing job. Once applied:

- Every new signup is encrypted **automatically** — the app calls
  `/api/profile`, which encrypts before writing. Nothing manual, ever.
- Every profile edit is encrypted automatically too, and clears any legacy
  plaintext on that row as a side effect.
- New trips automatically get a 6-character code from the database default.

You run the migration **once**, and `scripts/encrypt-existing-pii.mjs`
**once** (for accounts that already existed).

**Does it affect existing data?**

Nothing is deleted or broken. Specifically:

| Existing data | What happens |
|---|---|
| Profiles created before the migration | Untouched. New `*_enc` columns are added alongside and start `NULL`. The app reads ciphertext *or* plaintext, so those accounts keep working. |
| Old plaintext PII | Stays readable until you run the backfill, which encrypts it and nulls the plaintext. |
| Existing tracking codes (`NYSC-#####`) | **Keep working.** A column `DEFAULT` only applies to new rows, so trips already in flight are unaffected — only newly registered trips get 6-character codes. |
| Live trips mid-journey | Unaffected. Status, GPS and history all carry over. |
| Passwords / logins | Untouched — handled by Supabase Auth, not these columns. |

The one behavioural change for existing users: the parents' tracker no longer
shows the traveler's phone number or next-of-kin number, by design.

**What if I skip the backfill?**

Everything still works — old rows just stay in plaintext, so they're the ones
still exposed in a database leak. Run it to finish the job.

## Known trade-offs

- **The tracker polls instead of using realtime.** Supabase Realtime enforces
  RLS, and anonymous users no longer have `select` on `trips`. `/track` now
  refreshes every 15s (4/min against a 10/min limit). Admin dashboards keep
  realtime because admins are authenticated.
- **Rate limiting is per IP.** Everyone behind one mobile-carrier NAT shares a
  bucket. The limits are set high enough that this shouldn't bite, but if
  parents report "too many attempts", raise them in `track_trip()`.
- **You can still decrypt.** The key is in your Vercel env, so this protects
  against a database leak, not against you or anyone with project access.
  True zero-knowledge would require deriving keys from user passwords, which
  would stop admins from seeing who to help during an SOS.
