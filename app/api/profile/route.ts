import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { decryptProfile, encryptProfile } from "@/lib/crypto";

/**
 * The traveler's own profile. PII is encrypted at rest, so the browser can no
 * longer select these columns directly — it goes through here, where the
 * server holds the key.
 *
 * Authorisation: the caller's session decides whose row is touched. The id is
 * never taken from the request body.
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
  const { data, error } = await admin
    .from("profiles")
    .select(
      "id, role, jurisdiction, full_name, phone, next_of_kin, next_of_kin_email, full_name_enc, phone_enc, next_of_kin_enc, next_of_kin_email_enc",
    )
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("profile GET:", error.message);
    return NextResponse.json({ error: "Could not load profile" }, { status: 500 });
  }

  return NextResponse.json({
    profile: {
      id: user.id,
      role: data?.role ?? "pcm",
      jurisdiction: data?.jurisdiction ?? null,
      ...decryptProfile(data),
    },
  });
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const clean = (v: unknown) =>
    typeof v === "string" ? v.trim().slice(0, 200) : null;

  const fields = {
    full_name: clean(body.full_name),
    phone: clean(body.phone),
    next_of_kin: clean(body.next_of_kin),
    next_of_kin_email: clean(body.next_of_kin_email),
  };

  if (
    fields.next_of_kin_email &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.next_of_kin_email)
  ) {
    return NextResponse.json(
      { error: "Enter a valid next-of-kin email address." },
      { status: 400 },
    );
  }

  const admin = createServiceClient();
  const { error } = await admin.from("profiles").upsert(
    {
      id: user.id,
      ...encryptProfile(fields),
      // Clear any legacy plaintext this row still carries, so updating a
      // profile also completes its migration to encrypted-at-rest.
      full_name: null,
      phone: null,
      next_of_kin: null,
      next_of_kin_email: null,
    },
    { onConflict: "id" },
  );

  if (error) {
    console.error("profile PUT:", error.message);
    return NextResponse.json({ error: "Could not save profile" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, profile: fields });
}
