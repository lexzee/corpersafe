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
import { firstNameOf, useProfile } from "@/lib/use-profile";
import { getDistanceFromLatLonInKm, updateStatus } from "@/lib/utils";
import { geocodeDestination } from "@/lib/geo";
import {
  clearQueue,
  enqueuePoint,
  queueLength,
  readQueue,
} from "@/lib/offline-queue";
import { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  History,
  User as UserIcon,
  MapPin,
  Plus,
  ChevronRight,
  ArrowLeft,
  WifiOff,
  BatteryWarning,
  Smartphone,
  CheckCircle,
  AlertTriangle,
  Info,
  X,
} from "lucide-react";

const UserMapView = dynamic(
  () => import("@/components/map-views").then((mod) => mod.UserMapView),
  { ssr: false },
);

// Lightweight inline toast — states that matter to the traveler (auto-pause,
// offline, etc.) surface here instead of failing silently.
function ToastBar({
  toast,
  onDismiss,
}: {
  toast: any;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 6500);
    return () => clearTimeout(t);
  }, [toast, onDismiss]);

  if (!toast) return null;

  const Icon =
    toast.kind === "success"
      ? CheckCircle
      : toast.kind === "warning"
        ? AlertTriangle
        : Info;
  const tone =
    toast.kind === "success"
      ? "text-success"
      : toast.kind === "warning"
        ? "text-warning"
        : "text-primary";

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-4 inset-x-4 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:max-w-sm sm:w-full z-[60] animate-in slide-in-from-top-4"
    >
      <div className="bg-card border border-border shadow-2xl rounded-xl p-3 flex items-start gap-3">
        <Icon size={18} className={`${tone} shrink-0 mt-0.5`} />
        <p className="text-sm font-medium flex-1">{toast.message}</p>
        {toast.actionLabel && (
          <button
            onClick={() => {
              toast.onAction?.();
              onDismiss();
            }}
            className="shrink-0 text-xs font-bold text-primary underline underline-offset-2"
          >
            {toast.actionLabel}
          </button>
        )}
        <button
          onClick={onDismiss}
          aria-label="Dismiss notification"
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

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
  // Viewport default only (centre of Nigeria). The map marker is gated by
  // hasFix so we never plot a fabricated position.
  const [currentLoc, setCurrentLoc] = useState<[number, number]>([
    9.082, 8.6753,
  ]);
  const [hasFix, setHasFix] = useState(false);
  const [plateNumber, setPlateNumber] = useState<string>(
    trip?.plate_number || "",
  );
  const [screenAwake, setScreenAwake] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [syncIssue, setSyncIssue] = useState(false);
  const [lowBattery, setLowBattery] = useState(false);
  const [toast, setToast] = useState<any>(null);
  const wakeLockRef = useRef<any>(null);
  const syncFailCountRef = useRef(0);

  // Planned destination point (precise geocode of the camp when available,
  // else the destination state's centroid) — used to mark the destination,
  // draw the route and measure the remaining distance.
  const [destCoords, setDestCoords] = useState<[number, number] | null>(null);
  useEffect(() => {
    let active = true;
    void geocodeDestination(trip).then((point) => {
      if (active) setDestCoords(point);
    });
    return () => {
      active = false;
    };
    // Geocode is cached per camp; deps key on the fields that change it.
  }, [trip?.id, trip?.destination_state, trip?.destination_camp]); // eslint-disable-line react-hooks/exhaustive-deps

  // Straight-line distance from the latest GPS fix to the destination.
  const distanceToDestination =
    destCoords && hasFix
      ? getDistanceFromLatLonInKm(
          currentLoc[0],
          currentLoc[1],
          destCoords[0],
          destCoords[1],
        )
      : null;

  const dismissToast = useCallback(() => setToast(null), []);
  const showToast = useCallback(
    (
      message: string,
      kind: "info" | "success" | "warning" = "info",
      actionLabel?: string,
      onAction?: () => void,
    ) => setToast({ id: Date.now(), message, kind, actionLabel, onAction }),
    [],
  );

  // Drain GPS points buffered while offline: update the live position with
  // the newest fix and backfill trip_logs, so dead zones leave no gaps.
  const flushOfflineQueue = useCallback(async () => {
    if (!trip || !navigator.onLine) return;
    const queued = readQueue(trip.id);
    if (queued.length === 0) return;

    const supabase = createClient();
    try {
      const latest = queued[queued.length - 1];
      const { error } = await supabase
        .from("trips")
        .update({
          current_lat: latest.lat,
          current_lng: latest.lng,
          current_speed: latest.speed,
          last_updated: new Date().toISOString(),
        })
        .eq("id", trip.id);
      if (error) throw error;

      await supabase.from("trip_logs").insert(
        queued.map((p) => ({
          trip_id: trip.id,
          lat: p.lat,
          lng: p.lng,
          status_at_time: trip.status,
        })),
      );

      clearQueue(trip.id);
      showToast(
        `Back in coverage — ${queued.length} saved location${queued.length > 1 ? "s" : ""} synced.`,
        "success",
      );
    } catch (e) {
      console.warn("Offline queue flush failed:", e);
    }
  }, [trip, showToast]);

  // Flush on mount / when the trip changes
  useEffect(() => {
    void flushOfflineQueue();
  }, [flushOfflineQueue]);

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
    if (trip?.current_lat != null && trip?.current_lng != null) {
      setCurrentLoc([trip.current_lat, trip.current_lng]);
      setHasFix(true);
    }
  }, []);

  // Keep the screen awake while tracking — this browser tab IS the tracking
  // device, so the phone sleeping mid-journey silently stops updates.
  const isCompleted = trip?.status === "completed";
  useEffect(() => {
    if (isCompleted) return;

    let active = true;

    const requestWakeLock = async () => {
      try {
        if (!("wakeLock" in navigator)) return;
        const sentinel = await (navigator as any).wakeLock.request("screen");
        if (!active) {
          sentinel.release().catch(() => {});
          return;
        }
        wakeLockRef.current = sentinel;
        setScreenAwake(true);
        sentinel.addEventListener("release", () => {
          wakeLockRef.current = null;
          setScreenAwake(false);
        });
      } catch {
        // Requires a visible tab (and a user gesture on some browsers)
        setScreenAwake(false);
      }
    };

    void requestWakeLock();
    const onVisible = () => {
      if (document.visibilityState === "visible" && !wakeLockRef.current) {
        void requestWakeLock();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      active = false;
      document.removeEventListener("visibilitychange", onVisible);
      wakeLockRef.current?.release?.().catch(() => {});
      wakeLockRef.current = null;
      setScreenAwake(false);
    };
  }, [isCompleted]);

  // Connectivity + battery health. Offline must never look like danger —
  // the traveler gets a persistent banner and GPS keeps recording.
  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      setSyncIssue(false);
      syncFailCountRef.current = 0;
      showToast("Back online — live updates resumed.", "success");
      void flushOfflineQueue();
    };
    const handleOffline = () => {
      setIsOnline(false);
      showToast(
        "Connection lost — GPS keeps recording on this device.",
        "warning",
      );
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    let battery: any = null;
    const checkBattery = () => {
      if (battery) setLowBattery(!battery.charging && battery.level <= 0.2);
    };
    (navigator as any)
      .getBattery?.()
      .then((b: any) => {
        battery = b;
        checkBattery();
        b.addEventListener("levelchange", checkBattery);
        b.addEventListener("chargingchange", checkBattery);
      })
      .catch(() => {});

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      if (battery) {
        battery.removeEventListener("levelchange", checkBattery);
        battery.removeEventListener("chargingchange", checkBattery);
      }
    };
  }, [showToast, flushOfflineQueue]);

  //   Real-time GPS Tracking
  useEffect(() => {
    if (!navigator.geolocation) {
      showToast(
        "Geolocation is not supported by this browser.",
        "warning",
      );
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
        setHasFix(true);
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
            await updateStatus(
              "paused",
              "Traffic / Slow Movement",
              trip,
              setTrip,
              [latitude, longitude],
            );
            stopTimerRef.current = null; // Reset timer
            isAutoPausedRef.current = true;
            showToast(
              "Long stop detected — trip auto-paused (e.g. traffic).",
              "warning",
              "Resume now",
              () => {
                isAutoPausedRef.current = false;
                void updateStatus("active", null, trip, setTrip, [
                  latitude,
                  longitude,
                ]);
              },
            );
          }
        }
        // 2. DETECT MOVEMENT (Auto-Resume)
        else if (currentSpeedKmh > 10 && trip.status === "paused") {
          if (isAutoPausedRef.current) {
            // Only auto-resume if WE auto-paused it (don't override manual stops)
            await updateStatus("active", null, trip, setTrip, currentLoc);
            isAutoPausedRef.current = false;
            showToast("Movement detected — tracking resumed.", "success");
          }
          stopTimerRef.current = null;
        }
        // Reset timer if moving but not fast enough to resume yet
        else if (currentSpeedKmh >= 5) {
          stopTimerRef.current = null;
        }

        // C. REAL-TIME LOGGING TO SUPABASE
        // When offline (or failing repeatedly), buffer the point locally —
        // dead zones must not create history gaps or false "signal lost"
        // alarms. Repeated failures surface as a sync warning.
        if (!navigator.onLine) {
          enqueuePoint(trip.id, {
            lat: latitude,
            lng: longitude,
            speed: Math.round(currentSpeedKmh),
            ts: new Date(now).toISOString(),
          });
        } else {
          const { error: positionError } = await supabase
            .from("trips")
            .update({
              current_lat: latitude,
              current_lng: longitude,
              current_speed: Math.round(currentSpeedKmh),
              last_updated: new Date().toISOString(),
            })
            .eq("id", trip.id);

          if (positionError) {
            console.error("Position sync failed:", positionError);
            enqueuePoint(trip.id, {
              lat: latitude,
              lng: longitude,
              speed: Math.round(currentSpeedKmh),
              ts: new Date(now).toISOString(),
            });
            syncFailCountRef.current += 1;
            if (syncFailCountRef.current >= 3) setSyncIssue(true);
          } else {
            if (syncFailCountRef.current >= 3) setSyncIssue(false);
            syncFailCountRef.current = 0;
            // Piggyback a queue drain on live GPS events
            if (queueLength(trip.id) > 0) void flushOfflineQueue();
          }
        }

        // D. HISTORICAL LOGGING
        if (now - lastLogTimeRef.current > 60000 * 1) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- watch restarts only when the trip changes; currentLoc/supabase/setTrip are intentionally read from the closure
  }, [trip, showToast, flushOfflineQueue]);

  const handleStartTrip = async () => {
    setStarting(true);

    try {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { latitude, longitude } = pos.coords;
          // Plate number is collected at boarding time (see TripPending)
          const plate = (plateNumber || trip.plate_number || "")
            .trim()
            .toUpperCase();

          const { error } = await supabase
            .from("trips")
            .update({
              status: "active",
              plate_number: plate,
              current_lat: latitude,
              current_lng: longitude,
              last_updated: new Date().toISOString(),
            })
            .eq("id", trip.id);

          if (error) throw error;

          // Reflect the fix locally so the UI immediately knows the real
          // position (the trip row previously had null coordinates if the
          // user skipped GPS detection during registration).
          setCurrentLoc([latitude, longitude]);
          setHasFix(true);
          setTrip((prev: any) => ({
            ...prev,
            status: "active",
            plate_number: plate,
            current_lat: latitude,
            current_lng: longitude,
          }));
          setStarting(false);
        },
        (err) => {
          console.error("Start trip GPS error:", err);
          showToast(
            "Could not start the trip — check GPS permissions and try again.",
            "warning",
          );
          setStarting(false);
        },
        { enableHighAccuracy: true, timeout: 15000 },
      );
    } catch (e) {
      showToast(
        "Could not start the trip — check GPS permissions and try again.",
        "warning",
      );
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
        plateNumber={plateNumber}
        setPlateNumber={setPlateNumber}
      />
    );
  }

  return (
    // Extra bottom padding keeps content clear of the floating SOS control
    <div className="pb-36 min-h-screen bg-muted/30">
      <div className="bg-background border-b border-border p-2 sticky top-0 z-50">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
          <ArrowLeft size={16} /> Back to Dashboard
        </Button>
      </div>

      <UserNavbar status={trip.status} currentLoc={currentLoc} hasFix={hasFix} />

      {/* Screen-on reminder + connectivity/battery health */}
      <div className="max-w-md mx-auto px-4 pt-3 space-y-2">
        <div className="flex items-center gap-2 text-[11px] font-medium rounded-lg border border-border bg-muted/40 text-muted-foreground px-3 py-2">
          {screenAwake ? (
            <>
              <CheckCircle size={14} className="text-success shrink-0" />
              Screen will stay awake during this trip
            </>
          ) : (
            <>
              <Smartphone size={14} className="shrink-0" />
              Keep this screen on and the tab open — it&apos;s the tracking
              device
            </>
          )}
        </div>
        {(!isOnline || syncIssue) && (
          <div className="flex items-center gap-2 text-xs font-bold rounded-lg border border-warning/40 bg-warning/10 text-warning px-3 py-2 animate-in slide-in-from-top">
            <WifiOff size={14} className="shrink-0" />
            No connection — GPS keeps recording; updates resume when
            you&apos;re back online.
          </div>
        )}
        {lowBattery && (
          <div className="flex items-center gap-2 text-xs font-bold rounded-lg border border-warning/40 bg-warning/10 text-warning px-3 py-2 animate-in slide-in-from-top">
            <BatteryWarning size={14} className="shrink-0" />
            Battery low — plug in; tracking may stop if the phone dies.
          </div>
        )}
      </div>

      <div className="max-w-md mx-auto p-4 space-y-4">
        <TripStatus trip={trip} setShowPauseModal={setShowPauseModal} />

        {/* Live broadcast chip */}
        <div className="flex items-center justify-center gap-2 text-xs font-bold text-muted-foreground">
          {hasFix && isOnline && (
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-success"></span>
            </span>
          )}
          {hasFix
            ? isOnline
              ? "Live — your family can watch your journey"
              : "Recording locally (offline)"
            : "Acquiring GPS…"}
        </div>

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

            <CardContent className="pb-4">
              <div className="flex items-end gap-1">
                <span className="text-4xl font-black font-mono tracking-tighter">
                  {speed}
                </span>
                <span className="text-sm font-bold mb-1.5 text-muted-foreground">
                  km/h
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-1.5">
                {distanceToDestination != null
                  ? `${distanceToDestination.toFixed(1)} km to ${
                      trip.destination_camp || "camp"
                    }`
                  : destCoords
                    ? "Waiting for GPS to measure the distance…"
                    : "Destination route unavailable"}
              </div>
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
          <UserMapView
            currentLoc={currentLoc}
            speed={speed}
            trip={trip}
            hasFix={hasFix}
            destination={destCoords}
            routeFrom={hasFix ? currentLoc : null}
          />
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

      <PanicButton trip={trip} setTrip={setTrip} />

      {/* Transient notifications (auto-pause, offline, …) */}
      {toast && <ToastBar toast={toast} onDismiss={dismissToast} />}

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
  // The real name lives encrypted in profiles, not in user_metadata.
  const { profile } = useProfile();

  // 1. Fetch User & Trip
  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        // router.push("/auth/login");
        return;
      }
      setUser(user);

      // Fetch active trip (resolved incidents are closed, like completed)
      const { data } = await supabase
        .from("trips")
        .select("*")
        .eq("pcm_id", user.id)
        .neq("status", "completed")
        .neq("status", "resolved")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) setTrip(data);
      setLoading(false);
    };

    init();
  }, []);

  // When the active trip completes (traveler tapped "Arrived" inside the
  // tracking view), return to the dashboard — it shows an arrival card.
  useEffect(() => {
    if (trip?.status === "completed" && view === "tracking") {
      setView("dashboard");
    }
  }, [trip?.status, view]);

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
            {firstNameOf(profile)
              ? `Welcome, ${firstNameOf(profile)}`
              : "Welcome back"}
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
                : trip.status === "completed"
                  ? "Completed — you arrived safely"
                  : "Trip paused"
              : "No active trip"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {trip && trip.status === "completed" ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 bg-success/10 border border-success/30 rounded-lg p-3">
                <CheckCircle className="text-success shrink-0 mt-0.5" size={20} />
                <div className="text-sm">
                  <p className="font-bold">Arrival recorded</p>
                  <p className="text-muted-foreground">
                    Your trip to {trip.destination_state} has been safely
                    logged in your history.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => router.push("/history")}
                >
                  <History className="mr-2 h-4 w-4" /> View History
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => router.replace("/register-trip")}
                >
                  <Plus className="mr-2 h-4 w-4" /> New Trip
                </Button>
              </div>
            </div>
          ) : trip ? (
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
          className="hover:bg-muted/50 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => router.push("/history")}
          role="link"
          tabIndex={0}
          aria-label="View trip history"
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              router.push("/history");
            }
          }}
        >
          <CardContent className="p-6 flex flex-col items-center justify-center gap-3 text-center">
            <div className="p-3 bg-blue-100 text-blue-600 rounded-full dark:bg-blue-900/20 dark:text-blue-400">
              <History className="h-6 w-6" />
            </div>
            <span className="font-medium">History</span>
          </CardContent>
        </Card>
        <Card
          className="hover:bg-muted/50 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => router.push("/profile")}
          role="link"
          tabIndex={0}
          aria-label="View profile"
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              router.push("/profile");
            }
          }}
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
