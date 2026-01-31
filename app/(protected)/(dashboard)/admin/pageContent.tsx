"use client";

import dynamic from "next/dynamic";
import { runSafetyCheck, timeAgo, tripIsStale } from "@/lib/utils";
import { AdminNavbar } from "@/components/navbar";
import { AdminSidebar } from "@/components/sidebar";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Car,
  Loader2,
  Map as MapIcon,
  Shield,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LogoutButton } from "@/components/logout-button";

const AdminMapView = dynamic(
  () => import("@/components/map-views").then((mod) => mod.AdminMapView),
  { ssr: false },
);

function MonitorView({
  trips,
  user,
  profile,
  isMuted,
  setIsMuted,
  runSafetyCheck,
  loading,
  setLoading,
  setTrips,
  onBack,
}: any) {
  const supabase = createClient();
  const [selectedTrip, setSelectedTrip] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [vehicleDetails, setVehicleDetails] = useState<any>(null);

  const displayTrips = trips.filter(
    (t: any) =>
      t.plate_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.tracking_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const dangerCount = trips.filter((t: any) => t.status === "danger").length;

  // Fetch Vehicle Details when a trip is selected
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

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      {/* Header */}
      <header className="bg-background border-b border-border h-16 flex items-center justify-between px-4 z-20 shadow-sm shrink-0">
        <div className="flex items-center gap-2 mr-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft size={20} />
          </Button>
          <span className="font-bold hidden md:inline-block">
            Mission Control
          </span>
        </div>
        <div className="flex-1">
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
        </div>
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
  );
}

export function AdminContent({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const router = useRouter();
  const supabase = createClient();

  const [view, setView] = useState<"dashboard" | "monitor">("dashboard");
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
    audioRef.current = new Audio("/mixkit-alert-alarm-1005.wav");
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
  //   3. Danger Count for Audio
  const dangerCount = trips.filter((t) => t.status === "danger").length;

  // 4. Fetch Vehicle Details when a trip is selected
  //   4. Alarm
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

  if (view === "monitor") {
    return (
      <MonitorView
        trips={trips}
        user={user}
        profile={profile}
        isMuted={isMuted}
        setIsMuted={setIsMuted}
        runSafetyCheck={runSafetyCheck}
        loading={loading}
        setLoading={setLoading}
        setTrips={setTrips}
        onBack={() => setView("dashboard")}
      />
    );
  }

  // Dashboard View
  const activeTripsCount = trips.length;
  const dangerTripsCount = trips.filter((t) => t.status === "danger").length;
  const pausedTripsCount = trips.filter((t) => t.status === "paused").length;

  return (
    <div className="min-h-screen bg-muted/30 p-6 space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Admin Dashboard
          </h1>
          <p className="text-muted-foreground">
            Overview of current operations
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium">{profile?.full_name}</p>
            <p className="text-xs text-muted-foreground uppercase">
              {profile?.role?.replace("_", " ")}
            </p>
          </div>
          <LogoutButton />
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Trips</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeTripsCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Danger Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {dangerTripsCount}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paused</CardTitle>
            <Car className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pausedTripsCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Action */}
      <Card className="bg-primary text-primary-foreground overflow-hidden relative border-none">
        <div className="absolute right-0 top-0 h-full w-1/3 bg-white/10 -skew-x-12 transform translate-x-12" />
        <CardContent className="p-8 flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-6 w-6" />
              <h2 className="text-2xl font-bold">Live Monitoring Center</h2>
            </div>
            <p className="text-primary-foreground/80 max-w-md">
              Access the real-time map view to track vehicles, manage alerts,
              and communicate with drivers.
            </p>
          </div>
          <Button
            size="lg"
            variant="secondary"
            onClick={() => {
              enableAudio(); // Ensure audio context is unlocked
              setView("monitor");
            }}
            className="shrink-0 font-bold"
          >
            <MapIcon className="mr-2 h-5 w-5" /> Open Monitor
          </Button>
        </CardContent>
      </Card>

      {/* Recent Trips List (Simplified) */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Active Trips</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {trips.slice(0, 5).map((trip) => (
              <div
                key={trip.id}
                className="flex items-center justify-between border-b border-border last:border-0 pb-4 last:pb-0"
              >
                <div className="flex items-center gap-4">
                  <div className="bg-muted p-2 rounded-full">
                    <Car className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">
                      {trip.plate_number}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {trip.profiles?.full_name}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className={`text-xs font-bold px-2 py-1 rounded-full inline-block ${
                      trip.status === "active"
                        ? "bg-green-500/10 text-green-600"
                        : trip.status === "danger"
                          ? "bg-destructive/10 text-destructive"
                          : "bg-yellow-500/10 text-yellow-600"
                    }`}
                  >
                    {trip.status.toUpperCase()}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {timeAgo(trip.last_updated)}
                  </p>
                </div>
              </div>
            ))}
            {trips.length === 0 && (
              <p className="text-muted-foreground text-center py-4">
                No active trips.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
