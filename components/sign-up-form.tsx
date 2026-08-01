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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { AlertCircle, Shield } from "lucide-react";

export function SignUpForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const searchParams = useSearchParams();
  const nextPath = safeNextPath(searchParams.get("next")) || "/pcm";
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [nextOfKin, setNextOfKin] = useState("");
  const [nextOfKinEmail, setNextOfKinEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    if (password !== repeatPassword) {
      setError("Passwords do not match");
      setIsLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // The confirmation email's link lands on /auth/confirm, which is a
          // client page: Supabase's default {{ .ConfirmationURL }} template
          // redirects back with the session in the URL fragment, and the
          // browser client picks it up automatically. "next" carries the
          // user's intended destination (e.g. a tracking link) or falls back
          // to the traveler dashboard.
          emailRedirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent(nextPath)}`,
          data: {
            full_name: fullName,
            phone: phone,
            role: "pcm",
            // Persisted to profiles by the on_auth_user_created trigger, so
            // trip registration can pre-fill the emergency contact instead of
            // asking for it again.
            next_of_kin: nextOfKin,
            next_of_kin_email: nextOfKinEmail,
          },
        },
      });
      if (error) throw error;
      router.push("/auth/sign-up-success");
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

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
          <CardTitle className="text-2xl">Sign up</CardTitle>
          <CardDescription>Create a new account</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-6 bg-destructive/10 text-destructive p-3 rounded-lg text-sm flex items-center gap-2 border border-destructive/20">
              <AlertCircle size={16} />
              {error}
            </div>
          )}
          <form onSubmit={handleSignUp}>
            <div className="flex flex-col gap-6">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="fullName">FullName</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="John Doe"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="070 2347 5678"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="nextOfKin">Next of Kin&apos;s phone (optional)</Label>
                <Input
                  id="nextOfKin"
                  type="tel"
                  placeholder="Parent/Guardian's phone"
                  value={nextOfKin}
                  onChange={(e) => setNextOfKin(e.target.value)}
                />
                <p className="text-[10px] text-muted-foreground">
                  They&apos;ll receive an alert if you press the panic button
                  while travelling. You can also add this later from your
                  profile.
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="nextOfKinEmail">
                  Next of Kin&apos;s email (optional)
                </Label>
                <Input
                  id="nextOfKinEmail"
                  type="email"
                  placeholder="parent@example.com"
                  value={nextOfKinEmail}
                  onChange={(e) => setNextOfKinEmail(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="password">Password</Label>
                </div>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="repeat-password">Repeat Password</Label>
                </div>
                <Input
                  id="repeat-password"
                  type="password"
                  required
                  value={repeatPassword}
                  onChange={(e) => setRepeatPassword(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Creating an account..." : "Sign up"}
              </Button>
            </div>
            <div className="mt-4 text-center text-sm">
              Already have an account?{" "}
              <Link href="/auth/login" className="underline underline-offset-4">
                Login
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
