"use client";

import { AlertTriangle, History, Navigation, Shield, User } from "lucide-react";
import { LogoutButton } from "./logout-button";
import { Button } from "./ui/button";
import { useRouter } from "next/navigation";
import { ThemeSwitcher } from "./theme-switcher";
import {
  DemoButton,
  ManageStaffButton,
  MuteButton,
  SafetyCheckButton,
} from "./buttons";
import { createClient } from "@/lib/supabase/client";

export function UserNavbar({
  status,
  currentLoc,
}: {
  status: string;
  currentLoc: number[];
}) {
  const router = useRouter();
  return (
    <div className="bg-primary text-primary-foreground p-4 shadow-lg">
      <div className="flex justify-between items-center max-w-md mx-auto">
        <div className="flex items-center gap-2">
          <div className="bg-primary-foreground/20 p-2 rounded-full">
            <Navigation
              size={20}
              className={status === "active" ? "animate-pulse" : ""}
            />
          </div>
          <div>
            <h1 className="font-bold text-sm">Monitoring</h1>
            <p className="text-[10px] text-primary-foreground/80">
              GPS: {currentLoc[0].toFixed(4)}, {currentLoc[1].toFixed(4)}
            </p>
          </div>
        </div>
        <div className="flex items-center">
          <Button variant={"ghost"} onClick={() => router.push("/history")}>
            <History size={20} />
          </Button>
          <Button variant={"ghost"} onClick={() => router.push("/profile")}>
            <User size={20} />
          </Button>
          <ThemeSwitcher />
          <LogoutButton />
        </div>
      </div>
    </div>
  );
}

export function AdminNavbar({
  isMuted,
  setIsMuted,
  runSafetyCheck,
  loading,
  setLoading,
  dangerCount,
  setTrips,
  user,
  profile,
}: any) {
  const supabase = createClient();

  const generateDemoData = async () => {
    if (!confirm("Start Demo Mode? This will create 5 fake trips.")) return;
    setLoading(true);
    const { error } = await supabase.rpc("generate_demo_traffic", {
      admin_id: user?.id,
    });
    if (error) {
      console.error(error);
      alert("Error generating demo data");
    } else {
      alert("✅ Demo Traffic Generated! Check the map.");
      // Trigger refetch
      const { data } = await supabase
        .from("trips")
        .select("*, profiles(full_name, phone, next_of_kin)")
        .neq("status", "completed");
      if (data) setTrips(data);
    }
    setLoading(false);
  };

  return (
    <>
      {/* ... (Left side logo) ... */}
      <div className="flex items-center gap-3">
        <div className="bg-primary/10 p-2 rounded-lg">
          <Shield className="text-primary w-5 h-5" />
        </div>
        <div>
          <h1 className="font-bold text-foreground text-lg leading-tight">
            Security Overwatch
          </h1>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span>{profile?.jurisdiction || "National"} Control Center</span>
          </div>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex items-center gap-3">
        {/* Mute Button */}
        <MuteButton isMuted={isMuted} setIsMuted={setIsMuted} />

        {/* DEMO BUTTON */}
        <DemoButton generateDemoData={generateDemoData} />

        {/* Safety Check Button */}
        <SafetyCheckButton runSafetyCheck={runSafetyCheck} loading={loading} />

        {/* Stats Pills ... */}
        {dangerCount > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 bg-destructive text-destructive-foreground rounded-lg text-sm font-bold shadow-lg shadow-destructive/20 animate-pulse">
            <AlertTriangle size={18} />
            {dangerCount} SOS {dangerCount > 1 ? "S" : ""}
          </div>
        )}

        {/* Manage Staff Button */}
        <ManageStaffButton />

        <ThemeSwitcher />

        {/* Logout Button */}
        <LogoutButton />
      </div>
    </>
  );
}
