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
import { toast } from "@/lib/toast";
import { useCallback, useEffect, useRef, useState } from "react";

export function UserNavbar({
  status,
  currentLoc,
  hasFix = true,
}: {
  status: string;
  currentLoc: number[];
  hasFix?: boolean;
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
              {hasFix
                ? `GPS: ${currentLoc[0].toFixed(4)}, ${currentLoc[1].toFixed(4)}`
                : "Acquiring GPS…"}
            </p>
          </div>
        </div>
        <div className="flex items-center">
          <Button
            variant={"ghost"}
            aria-label="Trip history"
            onClick={() => router.push("/history")}
          >
            <History size={20} />
          </Button>
          <Button
            variant={"ghost"}
            aria-label="Profile"
            onClick={() => router.push("/profile")}
          >
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
  respondingCount = 0,
  setTrips,
  user,
  profile,
}: any) {
  const supabase = createClient();
  const [demoArmed, setDemoArmed] = useState(false);
  const demoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Whether fake demo trips currently exist (so the button toggles between
  // "Simulate" and "Stop Demo") and how many there are.
  const [demoActive, setDemoActive] = useState(false);
  const [demoCount, setDemoCount] = useState(0);

  // Demo fingerprint used by generate_demo_traffic() (kept in sync with
  // supabase/migrations/…demo_trips_cleanup.sql). The Stop Demo button can
  // only remove trips matching this pattern — real journeys are never at risk.
  const DEMO_FINGERPRINT =
    "plate_number.ilike.DEMO%,origin.ilike.%demo%,institution.ilike.%demo%";

  const checkDemoTrips = useCallback(async () => {
    const { data } = await supabase
      .from("trips")
      .select("id")
      .or(DEMO_FINGERPRINT);
    const count = data?.length ?? 0;
    setDemoCount(count);
    setDemoActive(count > 0);
  }, [supabase]);

  useEffect(() => {
    void checkDemoTrips();
    return () => {
      if (demoTimer.current) clearTimeout(demoTimer.current);
    };
  }, [checkDemoTrips]);

  // Manual "Dead Man Switch" scan — the util needs its dependencies and a
  // toast notifier (previously it was called bare, crashing on enableAudio,
  // and reported results via blocking alert()s).
  const handleSafetyCheck = () =>
    runSafetyCheck?.(false, () => {}, setLoading, setTrips, toast);

  // Two-phase trigger (instead of confirm()) for BOTH actions: the button is
  // "Simulate" when no demo trips exist and "Stop Demo" when they do.
  const handleDemoClick = () => {
    if (demoActive) {
      if (!demoArmed) {
        setDemoArmed(true);
        toast(
          demoCount > 0
            ? `Demo mode is on (${demoCount} fake trip${demoCount > 1 ? "s" : ""}). Tap Stop Demo again to remove them.`
            : "Demo mode is on. Tap Stop Demo again to remove the fake trips.",
          "warning",
        );
        demoTimer.current = setTimeout(() => setDemoArmed(false), 5000);
        return;
      }
      if (demoTimer.current) clearTimeout(demoTimer.current);
      setDemoArmed(false);
      void stopDemo();
      return;
    }

    if (!demoArmed) {
      setDemoArmed(true);
      toast(
        "Demo mode — tap Simulate again within 5s to create 5 fake trips.",
        "info",
      );
      demoTimer.current = setTimeout(() => setDemoArmed(false), 5000);
      return;
    }
    if (demoTimer.current) clearTimeout(demoTimer.current);
    setDemoArmed(false);
    void generateDemoData();
  };

  const generateDemoData = async () => {
    setLoading(true);
    const { error } = await supabase.rpc("generate_demo_traffic", {
      admin_id: user?.id,
    });
    if (error) {
      console.error(error);
      toast("Error generating demo data.", "error");
    } else {
      toast("Demo traffic generated — check the map.", "success");
      setDemoActive(true);
      setDemoCount((c) => c + 5);
      // Best-effort flag so Stop Demo can remove exactly these (the delete
      // RPC also matches by fingerprint, so this is purely for the flag).
      await supabase
        .from("trips")
        .update({ is_demo: true })
        .or(DEMO_FINGERPRINT);
      // Trigger refetch
      const { data } = await supabase
        .from("trips")
        .select("*, profiles(full_name, phone, next_of_kin)")
        .neq("status", "completed")
        .neq("status", "resolved");
      if (data) setTrips(data);
    }
    setLoading(false);
  };

  // Stop demo + delete the fake trips (and their GPS/audit rows) without
  // touching the Supabase dashboard. Prefers the SECURITY DEFINER RPC from
  // the migration (RLS has no delete policy on trips); falls back to direct
  // client deletes if the migration hasn't been applied yet.
  const stopDemo = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("delete_demo_traffic");

    if (error || data == null) {
      console.warn("delete_demo_traffic RPC unavailable:", error);
      try {
        const { data: demo, error: fetchError } = await supabase
          .from("trips")
          .select("id")
          .or(DEMO_FINGERPRINT);
        if (fetchError) throw fetchError;
        const ids = (demo || []).map((t) => t.id);
        for (const id of ids) {
          await supabase.from("trip_logs").delete().eq("trip_id", id);
          await supabase.from("alert_logs").delete().eq("trip_id", id);
          await supabase.from("trips").delete().eq("id", id);
        }
        toast(
          ids.length > 0
            ? `Demo stopped — ${ids.length} fake trip${ids.length > 1 ? "s" : ""} removed.`
            : "No demo trips found.",
          ids.length > 0 ? "success" : "info",
        );
        setDemoActive(false);
        setDemoCount(0);
      } catch (e) {
        console.error("Demo cleanup failed:", e);
        toast(
          "Could not remove demo trips — the DB migration may be missing.",
          "error",
        );
      }
    } else {
      const removed = Number(data) || 0;
      toast(
        removed > 0
          ? `Demo stopped — ${removed} fake trip${removed > 1 ? "s" : ""} removed.`
          : "No demo trips found.",
        removed > 0 ? "success" : "info",
      );
      setDemoActive(false);
      setDemoCount(0);
    }

    // Refresh the trip list either way
    const { data: trips } = await supabase
      .from("trips")
      .select("*, profiles(full_name, phone, next_of_kin)")
      .neq("status", "completed")
      .neq("status", "resolved");
    if (trips) setTrips(trips);
    setLoading(false);
  };

  return (
    <div className="flex items-center justify-between w-full">
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

        {/* DEMO BUTTON — Simulate ⇄ Stop Demo (removes the fake trips) */}
        <DemoButton
          generateDemoData={handleDemoClick}
          armed={demoArmed}
          demoActive={demoActive}
          onStopDemo={handleDemoClick}
        />

        {/* Safety Check Button */}
        <SafetyCheckButton
          runSafetyCheck={handleSafetyCheck}
          loading={loading}
        />

        {/* Stats Pills ... */}
        {dangerCount > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 bg-destructive text-destructive-foreground rounded-lg text-sm font-bold shadow-lg shadow-destructive/20 animate-pulse">
            <AlertTriangle size={18} />
            {dangerCount} SOS {dangerCount > 1 ? "S" : ""}
          </div>
        )}

        {respondingCount > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-bold shadow-lg shadow-amber-600/20">
            <Shield size={18} />
            {respondingCount} RESPONDING
          </div>
        )}

        {/* Manage Staff Button */}
        {/* <ManageStaffButton /> */}

        <ThemeSwitcher />

        {/* Logout Button */}
        <LogoutButton />
      </div>
    </div>
  );
}
