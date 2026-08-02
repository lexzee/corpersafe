import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { decryptField } from "@/lib/crypto";

/**
 * Public tracking endpoint — the only way an anonymous visitor can read trip
 * data now that the blanket anon SELECT policy is gone.
 *
 * Defence in depth:
 *   1. public.track_trip() returns a fixed column allow-list for ONE code.
 *   2. That function rate-limits per client key (10/min, 100/hour).
 *   3. The traveler's name is decrypted here and only the first name is
 *      returned — parents get reassurance copy, not a contact record.
 *   4. Responses are uniform on failure, so timing/shape can't be used to
 *      confirm whether a code exists.
 */

function clientKey(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  const ip = fwd?.split(",")[0]?.trim() || request.headers.get("x-real-ip");
  return ip || "unknown";
}

const NOT_FOUND = {
  error: "Tracking ID not found, or the trip has ended.",
} as const;

export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("code");
  if (!code) {
    return NextResponse.json({ error: "Enter a Tracking ID." }, { status: 400 });
  }

  let supabase;
  try {
    supabase = createServiceClient();
  } catch (err) {
    console.error("track route:", (err as Error).message);
    return NextResponse.json(
      { error: "Tracking is temporarily unavailable." },
      { status: 503 },
    );
  }

  const { data, error } = await supabase.rpc("track_trip", {
    p_code: code,
    p_client: clientKey(request),
  });

  if (error) {
    if (error.message?.includes("rate_limited")) {
      return NextResponse.json(
        { error: "Too many attempts. Please wait a minute and try again." },
        { status: 429 },
      );
    }
    if (error.message?.includes("invalid_code")) {
      return NextResponse.json(NOT_FOUND, { status: 404 });
    }
    console.error("track_trip RPC:", error.message);
    return NextResponse.json(
      { error: "Tracking is temporarily unavailable." },
      { status: 503 },
    );
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return NextResponse.json(NOT_FOUND, { status: 404 });

  // Prefer ciphertext, fall back to legacy plaintext during the cutover.
  const fullName = row.traveler_name_enc
    ? decryptField(row.traveler_name_enc)
    : row.traveler_name;
  const firstName = fullName?.trim().split(/\s+/)[0] ?? null;

  return NextResponse.json({
    trip: {
      id: row.id,
      tracking_code: row.tracking_code,
      status: row.status,
      pause_reason: row.pause_reason,
      origin: row.origin,
      destination_state: row.destination_state,
      destination_camp: row.destination_camp,
      destination_lat: row.destination_lat,
      destination_lng: row.destination_lng,
      current_lat: row.current_lat,
      current_lng: row.current_lng,
      current_speed: row.current_speed,
      plate_number: row.plate_number,
      last_updated: row.last_updated,
      // First name only — enough for "Alex is on the move", useless to a
      // stranger who guessed a code.
      traveler_first_name: firstName,
    },
  });
}
