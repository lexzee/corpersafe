"use client";

import { useEffect, useState } from "react";

export type Profile = {
  id: string;
  role: string;
  jurisdiction: string | null;
  full_name: string | null;
  phone: string | null;
  next_of_kin: string | null;
  next_of_kin_email: string | null;
};

/**
 * The signed-in user's own profile, with PII decrypted.
 *
 * Profile PII is AES-256-GCM ciphertext in Postgres, so it can't be read from
 * the browser (the key is server-side) and it is no longer mirrored into
 * auth.users.user_metadata. Any screen that needs the user's real name must
 * go through /api/profile — this hook is that single source of truth.
 */
export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/profile", { cache: "no-store" });
        if (!res.ok) throw new Error(`profile: ${res.status}`);
        const { profile } = await res.json();
        if (!cancelled) setProfile(profile);
      } catch (err) {
        console.error("Could not load profile:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { profile, loading };
}

/** First name for greetings, with a friendly fallback while loading. */
export function firstNameOf(profile: Profile | null): string {
  const full = profile?.full_name?.trim();
  if (!full) return "";
  return full.split(/\s+/)[0];
}
