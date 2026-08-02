import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  // With Fluid compute, don't put this client in a global environment
  // variable. Always create a new one on each request.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Do not run code between createServerClient and
  // supabase.auth.getClaims(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  // IMPORTANT: If you remove getClaims() and you use server-side rendering
  // with the Supabase client, your users may be randomly logged out.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  // Logged-in users never see the public landing page — straight to their
  // dashboard. PCMs (the signup default) go to /pcm; DB-only admins whose
  // JWT still says "pcm" get bounced to /admin by the /pcm page's own
  // server-side check, so defaulting to /pcm here is always safe.
  if (request.nextUrl.pathname === "/" && user) {
    const role = user?.user_metadata?.role;
    const isAdmin =
      typeof role === "string" &&
      ["admin", "super_admin", "state_admin", "school_admin"].includes(role);
    const url = request.nextUrl.clone();
    url.pathname = isAdmin ? "/admin" : "/pcm";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (
    request.nextUrl.pathname !== "/" &&
    !user &&
    !request.nextUrl.pathname.startsWith("/login") &&
    !request.nextUrl.pathname.startsWith("/auth") &&
    // Parents/guardians must be able to track a trip by code without an account
    !request.nextUrl.pathname.startsWith("/track") &&
    // API routes must never be redirected: they enforce their own auth and
    // return JSON. Redirecting /api/track to an HTML login page would break
    // the anonymous parents' tracker, and every other route would hand the
    // caller unparseable HTML instead of a 401.
    !request.nextUrl.pathname.startsWith("/api")
  ) {
    // no user, potentially respond by redirecting the user to the login page
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    // Preserve the intended destination so the login form can send the
    // user straight back (e.g. a parent opening a /track?code=... link)
    url.search = "";
    url.searchParams.set(
      "next",
      request.nextUrl.pathname + request.nextUrl.search,
    );
    return NextResponse.redirect(url);
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  // If you're creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return supabaseResponse;
}
