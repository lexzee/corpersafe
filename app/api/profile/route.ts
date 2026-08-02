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

/**
 * Resolve the caller from the session cookie, falling back to an explicit
 * `Authorization: Bearer <access_token>` header.
 *
 * The header path matters at signup: the browser calls this immediately after
 * signUp() resolves, and the auth cookie may not have been written yet. The
 * token is verified against Supabase either way — it is never trusted blindly.
 */
async function resolveUser(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) return user;

  const auth = request.headers.get("authorization");
  const token = auth?.toLowerCase().startsWith("bearer ")
    ? auth.slice(7).trim()
    : null;
  if (!token) return null;

  const admin = createServiceClient();
  const {
    data: { user: tokenUser },
  } = await admin.auth.getUser(token);
  return tokenUser ?? null;
}

export async function GET(request: Request) {
  const user = await resolveUser(request);

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

  const decrypted = decryptProfile(data);

  // Self-heal legacy accounts.
  //
  // Accounts created before this change kept their details in
  // auth.users.raw_user_meta_data. If the profile row has no name, adopt
  // whatever metadata exists, encrypt it, and persist — so a returning user
  // sees their name instead of a blank greeting, and the plaintext copy in
  // user_metadata stops being the source of truth.
  if (!decrypted.full_name) {
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    const str = (v: unknown) =>
      typeof v === "string" && v.trim() ? v.trim() : null;

    const recovered = {
      full_name: str(meta.full_name),
      phone: str(meta.phone) ?? decrypted.phone,
      next_of_kin: str(meta.next_of_kin) ?? decrypted.next_of_kin,
      next_of_kin_email:
        str(meta.next_of_kin_email) ?? decrypted.next_of_kin_email,
    };

    if (recovered.full_name) {
      const { error: healError } = await admin.from("profiles").upsert(
        {
          id: user.id,
          ...encryptProfile(recovered),
          full_name: null,
          phone: null,
          next_of_kin: null,
          next_of_kin_email: null,
        },
        { onConflict: "id" },
      );
      if (healError) {
        console.error("profile self-heal:", healError.message);
      } else {
        return NextResponse.json({
          profile: {
            id: user.id,
            role: data?.role ?? "pcm",
            jurisdiction: data?.jurisdiction ?? null,
            ...recovered,
          },
        });
      }
    }
  }

  return NextResponse.json({
    profile: {
      id: user.id,
      role: data?.role ?? "pcm",
      jurisdiction: data?.jurisdiction ?? null,
      ...decrypted,
    },
  });
}

export async function PUT(request: Request) {
  const user = await resolveUser(request);

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
