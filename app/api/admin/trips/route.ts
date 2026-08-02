import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { decryptProfile } from "@/lib/crypto";

const ADMIN_ROLES = ["admin", "state_admin", "school_admin", "super_admin"];

/**
 * Mission Control feed with traveler PII decrypted for authorised admins.
 *
 * When an SOS fires, responders need the name, phone, plate and next-of-kin
 * contact — that's the entire point of the dashboard. Those values are
 * ciphertext in Postgres, so decryption happens here after the role check.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const admin = createServiceClient();

  const { data: me } = await admin
    .from("profiles")
    .select("role, jurisdiction")
    .eq("id", user.id)
    .maybeSingle();

  if (!me || !ADMIN_ROLES.includes(String(me.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await admin
    .from("trips")
    .select(
      "*, profiles(full_name, phone, next_of_kin, next_of_kin_email, full_name_enc, phone_enc, next_of_kin_enc, next_of_kin_email_enc)",
    )
    .neq("status", "completed")
    .neq("status", "resolved");

  if (error) {
    console.error("admin trips:", error.message);
    return NextResponse.json({ error: "Could not load trips" }, { status: 500 });
  }

  // Jurisdiction scoping — mirrors the rules Mission Control already applied
  // client-side, enforced here as well so the raw feed never leaves the server
  // with trips this admin has no business seeing.
  // super_admin (and any admin without a jurisdiction set) sees everything.
  const scoped = (data ?? []).filter((t) => {
    if (me.role === "super_admin" || !me.jurisdiction) return true;
    if (me.role === "state_admin") {
      return (
        t.origin === me.jurisdiction || t.destination_state === me.jurisdiction
      );
    }
    if (me.role === "school_admin") return t.institution === me.jurisdiction;
    return true;
  });

  const trips = scoped.map((trip) => ({
    ...trip,
    profiles: decryptProfile(trip.profiles as never),
  }));

  return NextResponse.json({ trips });
}
