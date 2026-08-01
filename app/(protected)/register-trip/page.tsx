import { RegisterTripForm } from "@/components/register-trip-form";
import { createClient } from "@/lib/supabase/server";
import { isAdminRole } from "@/lib/utils";
import { redirect } from "next/navigation";

// Trip creation is for corps members — admins are bounced to Mission Control.
export default async function Page() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (isAdminRole(profile?.role)) redirect("/admin");
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <RegisterTripForm />
      </div>
    </div>
  );
}
