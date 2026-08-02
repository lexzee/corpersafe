import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client — server only, never import from a client
 * component. Bypasses RLS, so every route that uses it must do its own
 * authorisation check first.
 *
 * Needed because the encrypted PII columns are written and read by trusted
 * server routes: the browser no longer touches profile PII directly.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
