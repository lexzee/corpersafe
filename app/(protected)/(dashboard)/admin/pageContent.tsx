"use client";

import dynamic from "next/dynamic";
import { runSafetyCheck, timeAgo, tripIsStale } from "@/lib/utils";
import { AdminNavbar } from "@/components/navbar";
import { AdminSidebar } from "@/components/sidebar";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";

const AdminMapView = dynamic(
  () => import("@/components/map-views").then((mod) => mod.AdminMapView),
  { ssr: false },
);

export function AdminContent({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const router = useRouter();
  const supabase = createClient();

  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [trips, setTrips] = useState<any[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [vehicleDetails, setVehicleDetails] = useState<any>(null);

  const [isMuted, setIsMuted] = useState(false);
  const [audioAllowed, setAudioAllowed] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prevDangerCount = useRef(0);

  // AUdio Alert
  const enableAudio = () => {
    // Play empty sound to unloc audio engine
    if (audioRef.current) {
      audioRef.current
        .play()
        .then(() => {
          audioRef.current?.pause();
          setAudioAllowed(true);
          setIsMuted(false);
        })
        .catch((e) => console.error("Audio unlock failed", e));
    }
  };

  useEffect(() => {
    audioRef.current = new Audio("mixkit-alert-alarm-1005.wav");
    audioRef.current.loop = true;
  }, []);

  //   1. Get User and profile
  useEffect(() => {
    const fetchUser = async () => {
      setAuthLoading(true);
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        console.error(error.message);
        router.push("/auth/login");
      } else {
        setUser(data.user);
      }

      setAuthLoading(false);
    };
    fetchUser();
  }, []);
  useEffect(() => {
    const fetchProfile = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user?.id)
        .single();
      if (error) {
        console.error(error.message);
        router.push("/auth/login");
      } else {
        setProfile(data);
      }
    };

    if (user) fetchProfile();
  }, []);

  //   2. Load Data
  useEffect(() => {
    if (profile && profile.role === "pcm") {
      router.push("/pcm");
      return;
    }

    const fetchTrips = async (isBackgroundUpdate = false) => {
      if (!isBackgroundUpdate) setLoading(true);

      const { data, error } = await supabase
        .from("trips")
        .select("*, profiles(full_name, phone, next_of_kin)")
        .neq("status", "completed"); // Only active trips

      if (error) {
        console.error("Admin Fetch Error:", error);
      } else {
        // Client-side filtering for Jurisdiction
        const filtered = (data || []).filter((t) => {
          if (!profile?.jurisdiction) return true; // Super admin sees all

          if (profile.role === "state_admin") {
            return (
              t.origin === profile.jurisdiction ||
              t.destination_state === profile.jurisdiction
            );
          }
          if (profile.role === "school_admin") {
            return t.institution === profile.jurisdiction;
          }
          return true;
        });

        setTrips(filtered);
      }
      setLoading(false);
    };

    fetchTrips(false);

    // Real-time subscription
    const channel = supabase
      .channel("admin-room")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trips" },
        () => fetchTrips(true), // Refetch on any change
      )
      .subscribe();

    // Backup Watchdog
    const watchdogInterval = setInterval(() => {
      console.log("Client Watchdog: Checking signals...");
      runSafetyCheck(true, enableAudio, setLoading, setTrips);
    }, 120000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(watchdogInterval);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    };
  }, [user, profile]);

  //   3. Search Logic
  const displayTrips = trips.filter(
    (t) =>
      t.plate_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.tracking_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()),
  );
  const dangerCount = trips.filter((t) => t.status === "danger").length;

  // 4. Fetch Vehicle Details when a trip is selected
  useEffect(() => {
    if (selectedTrip && selectedTrip.plate_number) {
      setVehicleDetails(null);
      supabase
        .from("vehicles")
        .select("*")
        .eq("plate_number", selectedTrip.plate_number)
        .single()
        .then(({ data }) => {
          if (data) setVehicleDetails(data);
        });
    }
  }, [selectedTrip]);

  //   5. Alarm
  useEffect(() => {
    if (!audioRef.current) return;

    if (dangerCount > 0 && !isMuted && audioAllowed) {
      if (audioRef.current.paused) {
        audioRef.current
          .play()
          .catch((e) =>
            console.log(
              "Audio play blocked (user interaction needed first): ",
              e,
            ),
          );
      }
    } else {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    prevDangerCount.current = dangerCount;
  }, [dangerCount, isMuted, audioAllowed]);

  // --- RENDER ---
  if (loading || authLoading)
    return (
      <div className="flex h-screen items-center justify-center gap-2 bg-background">
        <Loader2 className="animate-spin text-primary" />
        <span className="font-bold text-muted-foreground">
          Loading Secure Portal...
        </span>
      </div>
    );

  return (
    <>
      <div className="flex flex-col h-screen overflow-hidden">
        {/* Header ... */}
        <header className="bg-background border-b border-border h-16 flex items-center justify-between px-6 z-20 shadow-sm">
          <AdminNavbar
            isMuted={isMuted}
            setIsMuted={setIsMuted}
            runSafetyCheck={runSafetyCheck}
            loading={loading}
            setLoading={setLoading}
            dangerCount={dangerCount}
            setTrips={setTrips}
            profile={profile}
            user={user}
          />
        </header>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <AdminSidebar
            displayTrips={displayTrips}
            selectedTrip={selectedTrip}
            setSelectedTrip={setSelectedTrip}
            tripIsStale={tripIsStale}
            timeAgo={timeAgo}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
          />

          {/* Map View */}
          <AdminMapView
            displayTrips={displayTrips}
            selectedTrip={selectedTrip}
            setSelectedTrip={setSelectedTrip}
            vehicleDetails={vehicleDetails}
          />
        </div>
      </div>
    </>
  );
}
