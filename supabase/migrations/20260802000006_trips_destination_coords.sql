-- ============================================================================
-- CorperSafe — trips: store precise destination coordinates (2026-08-02, part 6)
--
-- The destination marker should sit on the actual camp (allowed_states.campName),
-- not just the state centroid. Trip registration now geocodes the camp once
-- (free OSM Nominatim) and stores the result here; every dashboard — traveler,
-- parents' tracker, Mission Control — then pins the camp precisely without a
-- per-view geocode. Older rows keep working via the runtime geocode/centroid
-- fallbacks in lib/geo.ts.
-- Idempotent: safe to re-run.
-- ============================================================================

alter table public.trips add column if not exists destination_lat double precision;
alter table public.trips add column if not exists destination_lng double precision;
