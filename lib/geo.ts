// ---------------------------------------------------------------------------
// CorperSafe — lightweight geography helpers (no paid services).
//
// Trips store destinations as text (state + camp name). The camp name comes
// from the allowed_states.campName column at registration. To draw planned
// routes and measure distance we resolve a point per trip:
//   * precise path  — one-time Nominatim (OpenStreetMap) geocode of the CAMP
//                     name (allowed_states.campName), cached per camp; used
//                     on the traveler + parent views and stored on the trip
//                     (destination_lat/lng) at registration for everyone
//   * fallback      — a built-in centroid per Nigerian state (36 + FCT), so
//                     the maps still work fully offline / when geocoding is
//                     rate-limited or blocked (used everywhere)
// ---------------------------------------------------------------------------

// Approximate state capital / centre coordinates (lat, lng).
export const NIGERIA_STATE_CENTROIDS: Record<string, [number, number]> = {
  Abia: [5.5249, 7.4912],
  Adamawa: [9.2035, 12.4954],
  "Akwa Ibom": [5.0389, 7.9121],
  Anambra: [6.21, 7.0722],
  Bauchi: [10.3103, 9.8439],
  Bayelsa: [4.9218, 6.2676],
  Benue: [7.7337, 8.5211],
  Borno: [11.8311, 13.151],
  "Cross River": [4.9757, 8.3417],
  Delta: [6.198, 6.731],
  Ebonyi: [6.3249, 8.1137],
  Edo: [6.335, 5.6037],
  Ekiti: [7.6211, 5.2214],
  Enugu: [6.5244, 7.5189],
  FCT: [9.0579, 7.4951],
  Gombe: [10.2897, 11.1673],
  Imo: [5.482, 7.0304],
  Jigawa: [11.6996, 9.335],
  Kaduna: [10.5264, 7.4388],
  Kano: [12.0022, 8.592],
  Katsina: [12.9908, 7.6008],
  Kebbi: [12.4539, 4.1975],
  Kogi: [7.7999, 6.7436],
  Kwara: [8.4797, 4.5418],
  Lagos: [6.6018, 3.3515],
  Nasarawa: [8.4911, 8.5182],
  Niger: [9.6152, 6.5476],
  Ogun: [7.1607, 3.3484],
  Ondo: [7.2571, 5.2058],
  Osun: [7.7827, 4.5622],
  Oyo: [7.3775, 3.947],
  Plateau: [9.8965, 8.8583],
  Rivers: [4.8156, 7.0498],
  Sokoto: [13.0533, 5.2433],
  Taraba: [8.8833, 11.3596],
  Yobe: [11.747, 11.965],
  Zamfara: [12.1624, 6.664],
};

// Common ways the DB / user text might refer to the capital territory.
const STATE_ALIASES: Record<string, string> = {
  Abuja: "FCT",
  "Abuja FCT": "FCT",
  "Federal Capital Territory": "FCT",
  "FCT Abuja": "FCT",
};

// Minimal shape of a trip row as far as the geo helpers are concerned.
export interface TripGeo {
  current_lat?: number | null;
  current_lng?: number | null;
  origin?: string | null;
  destination_state?: string | null;
  destination_camp?: string | null;
  destination_lat?: number | null;
  destination_lng?: number | null;
}

/**
 * Resolve a free-form string ("Lagos", "FCT", "Akwa Ibom", "Jibowu Park,
 * Lagos", …) to a canonical state key from NIGERIA_STATE_CENTROIDS.
 */
export function resolveStateKey(input?: string | null): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  const alias = STATE_ALIASES[trimmed] ?? STATE_ALIASES[trimmed.toLowerCase()];
  if (alias) return alias;
  if (NIGERIA_STATE_CENTROIDS[trimmed]) return trimmed;

  const lower = trimmed.toLowerCase();
  // Longest names first so "Akwa Ibom" wins over "Akwa" (not a state anyway)
  const names = Object.keys(NIGERIA_STATE_CENTROIDS).sort(
    (a, b) => b.length - a.length,
  );
  for (const name of names) {
    if (lower.includes(name.toLowerCase())) return name;
  }
  return null;
}

/**
 * The "from" end of the planned route:
 * live/registered GPS coordinates when available, otherwise the centroid of
 * whatever Nigerian state appears in the origin text.
 */
export function getOriginPoint(trip: TripGeo | null | undefined): [number, number] | null {
  if (
    trip?.current_lat != null &&
    trip?.current_lng != null &&
    !Number.isNaN(Number(trip.current_lat)) &&
    !Number.isNaN(Number(trip.current_lng))
  ) {
    return [Number(trip.current_lat), Number(trip.current_lng)];
  }
  const key = resolveStateKey(trip?.origin);
  return key ? NIGERIA_STATE_CENTROIDS[key] : null;
}

/**
 * The "to" end of the planned route. Prefers explicit destination
 * coordinates if they ever get stored, otherwise the destination state's
 * centroid.
 */
export function getDestinationPoint(trip: TripGeo | null | undefined): [number, number] | null {
  if (
    trip?.destination_lat != null &&
    trip?.destination_lng != null &&
    !Number.isNaN(Number(trip.destination_lat)) &&
    !Number.isNaN(Number(trip.destination_lng))
  ) {
    return [Number(trip.destination_lat), Number(trip.destination_lng)];
  }
  const key = resolveStateKey(trip?.destination_state);
  return key ? NIGERIA_STATE_CENTROIDS[key] : null;
}

// Per-camp geocode cache (module-level, one request per camp per browser).
const campGeocodeCache = new Map<string, [number, number] | null>();

/**
 * Precise coordinates for a named camp via Nominatim (free OSM). Uses the
 * camp name (allowed_states.campName), NOT the bare state name, so the
 * marker sits on the actual camp. Returns null when offline/blocked/no hit
 * — callers decide their fallback.
 */
export async function geocodeCamp(
  camp: string | null | undefined,
  state: string | null | undefined,
): Promise<[number, number] | null> {
  const campName = camp?.trim();
  if (!campName) return null;

  const key = `camp|${state?.trim() || ""}|${campName}`;
  if (campGeocodeCache.has(key)) return campGeocodeCache.get(key) ?? null;

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=ng&q=${encodeURIComponent(
        `${campName}, ${state?.trim() || ""}, Nigeria`,
      )}`,
      { headers: { Accept: "application/json" } },
    );
    if (res.ok) {
      const data = await res.json();
      const hit = Array.isArray(data) && data[0] ? data[0] : null;
      if (hit?.lat != null && hit?.lon != null) {
        const point: [number, number] = [Number(hit.lat), Number(hit.lon)];
        campGeocodeCache.set(key, point);
        return point;
      }
    }
  } catch {
    // Offline / blocked — return null; caller falls back to the centroid
  }
  campGeocodeCache.set(key, null);
  return null;
}

/**
 * Best-effort precise destination coordinates for a trip: geocodes the CAMP
 * name (allowed_states.campName) via Nominatim, looking the camp name up
 * from allowed_states when the trip row only stored the state (older trips).
 * Falls back to the stored destination_lat/lng or the state centroid.
 */
export async function geocodeDestination(
  trip: TripGeo | null | undefined,
): Promise<[number, number] | null> {
  const fallback = getDestinationPoint(trip);
  let camp = trip?.destination_camp?.trim();
  const state = trip?.destination_state?.trim();

  // Older trips may lack destination_camp — recover the camp name from
  // allowed_states so we still pin the camp, not just the state.
  if (!camp && state) {
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const { data } = await createClient()
        .from("allowed_states")
        .select("campName")
        .eq("state", state)
        .maybeSingle();
      camp = (data?.campName as string | undefined)?.trim();
    } catch {
      // DB lookup unavailable — fall through to the centroid fallback
    }
  }

  return (await geocodeCamp(camp, state)) ?? fallback;
}
