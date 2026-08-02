import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { decryptProfile } from "@/lib/crypto";

/**
 * Returns the next-of-kin details needed to send an SOS email.
 *
 * The browser can't read these columns any more (they're ciphertext, and the
 * key is server-side), so the panic button asks here. Only the trip's own
 * traveler may call it.
 */
export async function GET(request: Request) {
  const tripId = new URL(request.url).searchParams.get("trip_id");
  if (!tripId) {
    return NextResponse.json({ error: "Missing trip_id" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const admin = createServiceClient();

  const { data: trip, error: tripError } = await admin
    .from("trips")
    .select("id, pcm_id, tracking_code, plate_number")
    .eq("id", tripId)
    .maybeSingle();

  if (tripError || !trip) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  }

  // Authorisation: only the traveler on this trip.
  if (trip.pcm_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: profile } = await admin
    .from("profiles")
    .select(
      "full_name, next_of_kin_email, full_name_enc, next_of_kin_email_enc",
    )
    .eq("id", user.id)
    .maybeSingle();

  const decrypted = decryptProfile(profile);

  return NextResponse.json({
    trip: {
      id: trip.id,
      tracking_code: trip.tracking_code,
      plate_number: trip.plate_number,
    },
    pcm_name: decrypted.full_name,
    next_of_kin_email: decrypted.next_of_kin_email,
  });
}
