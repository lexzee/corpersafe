"use client";

import { cn, safeNextPath } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Shield } from "lucide-react";
import type { EmailOtpType } from "@supabase/supabase-js";

type Status = "verifying" | "success" | "error";

/**
 * Confirms the email-verification / password-recovery link.
 *
 * Supabase's default email templates use `{{ .ConfirmationURL }}`, which
 * points at Supabase's hosted `/auth/v1/verify` endpoint. GoTrue verifies
 * the token there and then 302-redirects the browser back to this page with
 * the session in the URL *fragment* (`#access_token=...&type=signup`).
 * Fragments never reach the server, so this must be a client page: the
 * browser supabase-js client detects the fragment automatically when it
 * initialises and stores the session.
 *
 * Customised templates that link straight to the app are supported too:
 *  - `?token_hash=...&type=...`   (classic server-style links)
 *  - `?code=...`                  (PKCE / magic-link flows)
 *  - `?error=...`                 (GoTrue error redirects)
 */
export function ConfirmEmailForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<Status>("verifying");
  const [message, setMessage] = useState("");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    let cancelled = false;
    let authSubscription: {
      data: { subscription: { unsubscribe: () => void } };
    } | null = null;

    const unsubscribe = () => authSubscription?.data.subscription.unsubscribe();

    const timeout = setTimeout(() => {
      if (cancelled) return;
      unsubscribe();
      setStatus("error");
      setMessage(
        "We couldn't find a valid confirmation link. It may be expired or already used. Sign in with your password, or sign up again to receive a fresh confirmation email.",
      );
    }, 10000);

    const finish = (path: string) => {
      if (cancelled) return;
      clearTimeout(timeout);
      unsubscribe();
      setStatus("success");
      // Give the browser a beat to flush the session cookies before the
      // middleware guards the destination route.
      setTimeout(() => {
        if (!cancelled) router.replace(path);
      }, 400);
    };

    const fail = (reason: string) => {
      if (cancelled) return;
      clearTimeout(timeout);
      unsubscribe();
      setStatus("error");
      setMessage(reason);
    };

    const run = async () => {
      const supabase = createClient();
      const nextPath = safeNextPath(searchParams.get("next")) || "/pcm";

      // GoTrue redirects here with ?error=... when the token is expired,
      // already used, or otherwise invalid.
      const errorParam = searchParams.get("error");
      if (errorParam) {
        fail(errorParam);
        return;
      }

      // PKCE / magic-link style callback (?code=...)
      const code = searchParams.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) return fail(error.message);
        return finish(nextPath);
      }

      // Customised template linking straight to the app
      // (?token_hash=...&type=... or ?token=...&type=...)
      const tokenHash =
        searchParams.get("token_hash") ?? searchParams.get("token");
      const type = searchParams.get("type") as EmailOtpType | null;
      if (tokenHash && type) {
        const { error } = await supabase.auth.verifyOtp({
          type,
          token_hash: tokenHash,
        });
        if (error) return fail(error.message);
        return finish(nextPath);
      }

      // Default template ({{ .ConfirmationURL }}): GoTrue already verified
      // the token server-side and redirected here with the session in the
      // URL fragment. The browser client picks it up during initialisation —
      // wait for the session to land.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) return finish(nextPath);

      authSubscription = supabase.auth.onAuthStateChange((event, session) => {
        if (event === "SIGNED_IN" && session) finish(nextPath);
      });
    };

    run();

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      unsubscribe();
      // React StrictMode (dev) mounts -> unmounts -> remounts the component.
      // The first run is cancelled above, so let the remount take over.
      started.current = false;
    };
  }, [router, searchParams]);

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center animate-in slide-in-from-top duration-500">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 text-primary font-bold text-xl mb-2"
          >
            <div className="bg-background p-2 rounded-lg">
              <Shield className="fill-primary text-secondary-foreground w-6 h-6" />
            </div>
            CorperSafe
          </Link>
          <CardTitle className="text-2xl">
            {status === "verifying" && "Confirming your email…"}
            {status === "success" && "Email confirmed!"}
            {status === "error" && "Link problem"}
          </CardTitle>
          <CardDescription>
            {status === "verifying" && "Just a moment…"}
            {status === "success" && "Your account is verified"}
            {status === "error" && "We couldn't complete the confirmation"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4 text-center">
          {status === "verifying" && (
            <Loader2 className="animate-spin text-primary" size={32} />
          )}
          {status === "success" && (
            <CheckCircle2 className="text-green-600" size={32} />
          )}
          {status === "error" && (
            <AlertCircle className="text-destructive" size={32} />
          )}
          {message && (
            <p className="text-sm text-muted-foreground">{message}</p>
          )}
          <div className="flex w-full flex-col gap-2">
            {status !== "verifying" && (
              <Button asChild variant={status === "error" ? "default" : "secondary"}>
                <Link
                  href={
                    status === "error"
                      ? "/auth/login"
                      : safeNextPath(searchParams.get("next")) || "/pcm"
                  }
                >
                  {status === "error" ? "Go to sign in" : "Continue to dashboard"}
                </Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
