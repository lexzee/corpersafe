import { createClient } from "@/lib/supabase/server";
import { isAdminRole } from "@/lib/utils";
import { redirect } from "next/navigation";
import { PCMContent } from "./pageContent";

// Admins get Mission Control only — the traveler dashboard is off-limits.
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
    <div className="flex min-h-svh w-full justify-center">
      <div className="w-full">
        <PCMContent />
      </div>
    </div>
  );
}
