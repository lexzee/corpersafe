"use client";

import dynamic from "next/dynamic";
import { ArrivedButton, PauseResumeButton } from "@/components/buttons";
import {
  TripStatus,
  TrackingID,
  PauseModal,
  TripPending,
} from "@/components/cards";
import { LogoutButton } from "@/components/logout-button";
import { UserNavbar } from "@/components/navbar";
import PanicButton from "@/components/panic-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { getDistanceFromLatLonInKm, updateStatus } from "@/lib/utils";
import { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  History,
  User as UserIcon,
  MapPin,
  Plus,
  ChevronRight,
  ArrowLeft,
} from "lucide-react";

const UserMapView = dynamic(
  () => import("@/components/map-views").then((mod) => mod.UserMapView),
  { ssr: false },
);

function TrackingView({
  trip,
  setTrip,
  onBack,
}: {
  trip: any;
  setTrip: any;
  onBack: () => void;
}) {
  const supabase = createClient();

  const [showPauseModal, setShowPauseModal] = useState(false);
  const [starting, setStarting] = useState(false);
  const [speed, setSpeed] = useState(0);
  const [gpsAccuracy, setGpsAccuracy] = useState(0);
  const [currentLoc, setCurrentLoc] = useState<[number, number]>([
    0.343234, 0.243244,
  ]);

  // Refs for Auto-Stop Logic
  const lastPosRef = useRef<{ lat: number; lng: number; time: number } | null>(
    null,
  );
  const stopTimerRef = useRef<number | null>(null); // Timestamp when stop started
  const isAutoPausedRef = useRef(false);

  // Log throttling
  const lastLogTimeRef = useRef<number>(0);

  // Initialize location from trip data if available
  useEffect(() => {
    if (trip?.current_lat) {
      setCurrentLoc([trip.current_lat, trip.current_lng]);
    }
  }, []);

  //   Real-time GPS Tracking
  useEffect(() => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }

    if (!trip || trip.status === "completed" || trip.status === "pending")
      return;

    const geoId = navigator.geolocation.watchPosition(
      async (position) => {
        const {
          latitude,
          longitude,
          accuracy,
          speed: rawSpeed,
        } = position.coords;
        const now = Date.now();

        setCurrentLoc([latitude, longitude]);
        setGpsAccuracy(accuracy);

        // --- A. Calculate Speed (km/h) ---
        let currentSpeedKmh = 0;

        if (rawSpeed !== null && rawSpeed >= 0) {
          // Use browser speed if available (rawSpeed is m/s)
          currentSpeedKmh = rawSpeed * 3.6;
        } else if (lastPosRef.current) {
          // Fallback: Calculate manually based on distance/time
          const distKm = getDistanceFromLatLonInKm(
            lastPosRef.current.lat,
            lastPosRef.current.lng,
            latitude,
            longitude,
          );
          const timeDiffHrs =
            (now - lastPosRef.current.time) / (1000 * 60 * 60);

          if (timeDiffHrs > 0) currentSpeedKmh = distKm / timeDiffHrs;
        }

        // Filter noise: If speed is very low, count as 0
        if (currentSpeedKmh < 1) currentSpeedKmh = 0;
        setSpeed(Math.round(currentSpeedKmh));

        // Update Ref for next calculation
        lastPosRef.current = { lat: latitude, lng: longitude, time: now };

        // --- B. Auto-Pause Logic ---
        // Thresholds: Stop < 5km/h, Move > 10km/h, Time = 5 mins (300000ms)

        // 1. DETECT STOP
        if (currentSpeedKmh < 5 && trip.status === "active") {
          if (!stopTimerRef.current) {
            stopTimerRef.current = now; // Start timer
          } else if (now - stopTimerRef.current > 300000) {
            // 5 Minutes
            // Trigger Auto-Pause
            console.log("Auto-Pause Triggered");
            await updateStatus(
              "paused",
              "Traffic / Slow Movement",
              trip,
              setTrip,
              [latitude, longitude],
            );
            stopTimerRef.current = null; // Reset timer
            isAutoPausedRef.current = true;
          }
        }
        // 2. DETECT MOVEMENT (Auto-Resume)
        else if (currentSpeedKmh > 10 && trip.status === "paused") {
          if (isAutoPausedRef.current) {
            // Only auto-resume if WE auto-paused it (don't override manual stops)
            console.log("Auto-Resume Triggered");
            await updateStatus("active", null, trip, setTrip, currentLoc);
            isAutoPausedRef.current = false;
          }
          stopTimerRef.current = null;
        }
        // Reset timer if moving but not fast enough to resume yet
        else if (currentSpeedKmh >= 5) {
          stopTimerRef.current = null;
        }

        // C. REAL-TIME LOGGING TO SUPABASE
        // Push to Supabase
        await supabase
          .from("trips")
          .update({
            current_lat: latitude,
            current_lng: longitude,
            current_speed: Math.round(currentSpeedKmh),
            last_updated: new Date().toISOString(),
          })
          .eq("id", trip.id);

        // D. HISTORICAL LOGGING
        if (now - lastLogTimeRef.current > 60000 * 1) {
          console.log("Writing to Trip Logs...");
          const { error: logError } = await supabase.from("trip_logs").insert({
            trip_id: trip.id,
            lat: latitude,
            lng: longitude,
            status_at_time: trip.status,
          });

          if (logError?.message) console.error("Log Error: ", logError);
          else lastLogTimeRef.current = now;
        }
      },
      (err) => console.error("GPS Error:", err),
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 2000, // Don't accept old cached positions
      },
    );

    return () => navigator.geolocation.clearWatch(geoId);
  }, [trip]);

  const handleStartTrip = async () => {
    setStarting(true);

    try {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const { latitude, longitude } = pos.coords;

        const { error } = await supabase
          .from("trips")
          .update({
            status: "active",
            current_lat: latitude,
            current_lng: longitude,
            last_updated: new Date().toISOString(),
          })
          .eq("id", trip.id);

        if (error) throw error;

        setTrip((prev: any) => ({ ...prev, status: "active" }));
      });
    } catch (e) {
      alert("Could not start trip. Check GPS permissions.");
    } finally {
      setStarting(false);
    }
  };

  const handlePauseClick = () => {
    if (trip.status === "paused") {
      updateStatus("active", null, trip, setTrip, currentLoc);
    } else {
      updateStatus("paused", null, trip, setTrip, currentLoc);
      setShowPauseModal(true);
    }
  };

  const confirmPause = (reason: string) => {
    updateStatus("paused", reason, trip, setTrip, currentLoc);
    setShowPauseModal(false);
  };

  if (!trip) return null;

  if (trip.status === "pending") {
    return (
      <TripPending
        trip={trip}
        handleStartTrip={handleStartTrip}
        starting={starting}
      />
    );
  }

  return (
    <div className="pb-24 min-h-screen bg-muted/30">
      <div className="bg-background border-b border-border p-2 sticky top-0 z-50">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
          <ArrowLeft size={16} /> Back to Dashboard
        </Button>
      </div>

      <UserNavbar status="" currentLoc={currentLoc} />

      <div className="max-w-md mx-auto p-4 space-y-4">
        <TripStatus trip={trip} setShowPauseModal={setShowPauseModal} />

        {/* Speed Card */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="col-span-2">
            <CardHeader className="pb-2">
              <CardDescription className="uppercase text-xs font-bold tracking-wider">
                Destination
              </CardDescription>
              <CardTitle className="truncate text-lg leading-tight">
                {trip.destination_state} Camp
              </CardTitle>
            </CardHeader>

            <CardContent className="flex items-end gap-1 pb-4">
              <span className="text-4xl font-black font-mono tracking-tighter">
                {speed}
              </span>
              <span className="text-sm font-bold mb-1.5 text-muted-foreground">
                km/h
              </span>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold uppercase text-muted-foreground">
                GPS
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="text-xl font-bold mb-2">
                {Math.round(gpsAccuracy)}
                <span className="text-xs font-normal text-muted-foreground ml-0.5">
                  m
                </span>
              </div>
              <div
                className={`h-1.5 w-full rounded-full ${
                  gpsAccuracy < 20 ? "bg-primary" : "bg-yellow-500"
                }`}
              ></div>
            </CardContent>
          </Card>
        </div>

        {/* Tracking ID */}
        <TrackingID tracking_code={trip.tracking_code} />

        {/* Map */}
        <div className="h-64 bg-card rounded-2xl overflow-hidden border border-border shadow-sm relative z-0">
          <UserMapView currentLoc={currentLoc} speed={speed} trip={trip} />
        </div>

        {/* Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <PauseResumeButton
            status={trip.status}
            handlePauseClick={handlePauseClick}
          />
          <ArrivedButton
            trip={trip}
            currentLoc={currentLoc}
            setTrip={setTrip}
          />
        </div>

        <div className="text-center text-xs text-muted-foreground pt-4">
          Emergency? Press the SOS button below.
        </div>
      </div>

      <PanicButton tripId={trip.id} />

      {/* Pause Modal */}
      {showPauseModal && (
        <PauseModal
          setShowPauseModal={setShowPauseModal}
          confirmPause={confirmPause}
        />
      )}
    </div>
  );
}

export function PCMContent({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const supabase = createClient();
  const router = useRouter();

  const [view, setView] = useState<"dashboard" | "tracking">("dashboard");
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [trip, setTrip] = useState<any>(null);

  // 1. Fetch User & Trip
  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/auth/login");
        return;
      }
      setUser(user);

      // Fetch active trip
      const { data } = await supabase
        .from("trips")
        .select("*")
        .eq("pcm_id", user.id)
        .neq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) setTrip(data);
      setLoading(false);
    };

    init();
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background flex-col gap-4">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
        <p className="text-muted-foreground text-sm">
          Loading Mission Control...
        </p>
      </div>
    );
  }

  if (view === "tracking" && trip) {
    return (
      <TrackingView
        trip={trip}
        setTrip={setTrip}
        onBack={() => setView("dashboard")}
      />
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 p-4 pb-24 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground text-sm">
            Welcome, {user?.user_metadata?.full_name}
          </p>
        </div>
        <LogoutButton />
      </div>

      {/* Active Trip Section */}
      <Card className="border-primary/20 shadow-md overflow-hidden relative">
        <div className="absolute top-0 left-0 w-1 h-full bg-primary"></div>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <MapPin className="text-primary h-5 w-5" />
            Current Trip
          </CardTitle>
          <CardDescription>
            {trip
              ? trip.status === "active"
                ? "Trip in progress"
                : "Trip paused"
              : "No active trip"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {trip ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-muted/50 p-3 rounded-lg">
                <div className="text-sm">
                  <p className="text-muted-foreground text-xs uppercase font-bold">
                    Destination
                  </p>
                  <p className="font-medium">{trip.destination_state}</p>
                </div>
                <div className="text-right">
                  <p className="text-muted-foreground text-xs uppercase font-bold">
                    Status
                  </p>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary uppercase">
                    {trip.status}
                  </span>
                </div>
              </div>
              <Button className="w-full" onClick={() => setView("tracking")}>
                View Live Tracking <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button
              className="w-full"
              onClick={() => router.replace("/register-trip")}
            >
              <Plus className="mr-2 h-4 w-4" /> Start New Trip
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-4">
        <Card
          className="hover:bg-muted/50 transition-colors cursor-pointer"
          onClick={() => router.push("/history")}
        >
          <CardContent className="p-6 flex flex-col items-center justify-center gap-3 text-center">
            <div className="p-3 bg-blue-100 text-blue-600 rounded-full dark:bg-blue-900/20 dark:text-blue-400">
              <History className="h-6 w-6" />
            </div>
            <span className="font-medium">History</span>
          </CardContent>
        </Card>
        <Card
          className="hover:bg-muted/50 transition-colors cursor-pointer"
          onClick={() => router.push("/profile")}
        >
          <CardContent className="p-6 flex flex-col items-center justify-center gap-3 text-center">
            <div className="p-3 bg-purple-100 text-purple-600 rounded-full dark:bg-purple-900/20 dark:text-purple-400">
              <UserIcon className="h-6 w-6" />
            </div>
            <span className="font-medium">Profile</span>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
