"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { useState } from "react";

// Full session teardown:
//  1. revoke the refresh token server-side (scope: global)
//  2. scrub sb-* auth cookies by hand in case the network call failed
//  3. drop app-local state (offline GPS queue, sessionStorage)
//  4. hard-navigate so every in-memory store, realtime channel and
//     geolocation watch dies with the page
export function LogoutButton() {
  const [busy, setBusy] = useState(false);

  const logout = async () => {
    if (busy) return;
    setBusy(true);

    try {
      const supabase = createClient();
      await supabase.auth.signOut({ scope: "global" });
    } catch (e) {
      // Offline is fine — the cookie scrub below still ends the local session
      console.warn("Server-side sign-out failed, clearing locally:", e);
    }

    try {
      document.cookie.split(";").forEach((c) => {
        const name = c.split("=")[0].trim();
        if (name.startsWith("sb-")) {
          document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
        }
      });
      Object.keys(window.localStorage)
        .filter((k) => k.startsWith("corpersafe_"))
        .forEach((k) => window.localStorage.removeItem(k));
      window.sessionStorage.clear();
    } catch {
      // storage/cookies may be unavailable (privacy mode) — reload anyway
    }

    window.location.assign("/auth/login");
  };

  return (
    <Button onClick={logout} disabled={busy}>
      {busy ? "Signing out…" : "Logout"}
    </Button>
  );
}
