import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

// One auth client per tab. Previously every component created its own
// browser client, spawning competing GoTrue instances that fight over the
// Navigator LockManager — the first navigation right after sign-in could
// stall indefinitely on getUser()/getSession(), leaving pages (notably
// /admin) on their loading screen until a history back+forward nudged it.
export function createClient(): SupabaseClient {
  // Client components also render on the server during SSR. Never cache
  // there — a module-level instance would be shared across requests on
  // the same worker.
  if (typeof window === "undefined") {
    return createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    );
  }

  const g = globalThis as {
    __corpersafeSupabase?: SupabaseClient;
  };
  if (!g.__corpersafeSupabase) {
    g.__corpersafeSupabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    );
  }
  return g.__corpersafeSupabase;
}
