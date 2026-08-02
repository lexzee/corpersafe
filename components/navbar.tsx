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
  trips,
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

  // Detect demo trips from the DB so the button reflects reality:
  //   1. is_demo flag (migration 20260802000003 applied) — authoritative.
  //   2. if the flag column doesn't exist yet (migration not applied), the
  //      combined query errors and we fall back to the fingerprint match.
  const checkDemoTrips = useCallback(async () => {
    const demoFilter = `is_demo.eq.true,${DEMO_FINGERPRINT}`;
    const { data } = await supabase.from("trips").select("id").or(demoFilter);
    if (data == null) {
      // Column missing → retry with the fingerprint only
      const { data: fallback } = await supabase
        .from("trips")
        .select("id")
        .or(DEMO_FINGERPRINT);
      const count = fallback?.length ?? 0;
      setDemoCount(count);
      setDemoActive(count > 0);
      return;
    }
    const count = data.length;
    setDemoCount(count);
    setDemoActive(count > 0);
  }, [supabase]);

  // Re-check whenever the trip list changes (realtime, generation, deletion)
  // so the button toggles to "Stop Demo" the moment fake trips appear.
  useEffect(() => {
    void checkDemoTrips();
  }, [checkDemoTrips, trips]);

  useEffect(() => {
    return () => {
      if (demoTimer.current) clearTimeout(demoTimer.current);
    };
  }, []);

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
      // Flag the freshly created trips so Stop Demo can remove exactly
      // these. Match on the demo fingerprint AND a recent created_at window
      // (belt-and-braces: even if the generator's rows don't match the
      // fingerprint, the ones just created are still marked is_demo).
      const since = new Date(Date.now() - 60_000).toISOString();
      await supabase
        .from("trips")
        .update({ is_demo: true })
        .or(DEMO_FINGERPRINT)
        .gte("created_at", since);
      // Trigger refetch (via the admin API: PII is encrypted at rest)
      const res = await fetch("/api/admin/trips", { cache: "no-store" });
      if (res.ok) {
        const { trips } = await res.json();
        if (trips) setTrips(trips);
      }
      // Re-sync the button state from the DB (the trips-prop effect also
      // does this, but do it here so the label flips immediately).
      await checkDemoTrips();
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
        // is_demo-aware, same fallback chain as checkDemoTrips
        const demoFilter = `is_demo.eq.true,${DEMO_FINGERPRINT}`;
        const { data: demo } = await supabase
          .from("trips")
          .select("id")
          .or(demoFilter);
        const demoRows = demo ?? (await supabase.from("trips").select("id").or(DEMO_FINGERPRINT)).data;
        const ids = (demoRows || []).map((t) => t.id);
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

    // Refresh the trip list either way (admin API decrypts traveler PII)
    const refreshed = await fetch("/api/admin/trips", { cache: "no-store" });
    if (refreshed.ok) {
      const { trips } = await refreshed.json();
      if (trips) setTrips(trips);
    }
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
