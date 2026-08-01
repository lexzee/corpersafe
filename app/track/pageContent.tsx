"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  Shield,
  Search,
  Navigation,
  Phone,
  User,
  Clock,
  AlertTriangle,
  CheckCircle,
  ArrowLeft,
  MapPin,
} from "lucide-react";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  getDistanceFromLatLonInKm,
  normalizeTrackingCode,
  timeAgo,
  tripIsStale,
} from "@/lib/utils";
import { geocodeDestination, getOriginPoint } from "@/lib/geo";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const TrackingMap = dynamic(() => import("./TrackingMap"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-muted rounded-xl text-muted-foreground">
      Loading Map...
    </div>
  ),
});

export default function TrackPageContent({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const urlCode = searchParams.get("code");

  const [inputCode, setInputCode] = useState(urlCode || "");
  const [trip, setTrip] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  // Planned destination point — precise geocode of the camp when available,
  // otherwise the destination state's centroid (offline fallback).
  const [destCoords, setDestCoords] = useState<[number, number] | null>(null);
  // Realtime connection health — shown to parents as Live / Connecting
  const [connState, setConnState] = useState<"connecting" | "live" | "offline">(
    "offline",
  );
  // Ticker so "last seen X ago" stays honest while the page is open
  const [, setNow] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setNow((n) => n + 1), 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (urlCode) handleTrack(urlCode);
  }, [urlCode]);

  // Initial Search Handler
  const handleTrack = async (codeToTrack: string) => {
    if (!codeToTrack) return;
    setLoading(true);
    setError("");
    setTrip(null);
    setDestCoords(null);

    try {
      // 1. Fetch Trip Data + Driver/PCM Info
      // Parents type codes every possible way ("53198", "nysc 53198",
      // "NYSC53198") — normalise to the stored "NYSC-#####" form.
      const cleanCode = normalizeTrackingCode(codeToTrack);
      if (!cleanCode) {
        throw new Error("Enter your Tracking ID, e.g. NYSC-53198");
      }
      const { data, error } = await supabase
        .from("trips")
        .select("*, profiles(full_name, phone, next_of_kin)")
        .eq("tracking_code", cleanCode)
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error("Tracking ID not found or trip has ended.");
      setTrip(data);
      // last_updated is null until the traveler starts broadcasting GPS
      setLastUpdate(data.last_updated ? new Date(data.last_updated) : null);
      // Resolve the planned route destination (async precise geocode, with
      // an immediate state-centroid fallback already baked into the helper).
      void geocodeDestination(data).then((point) => {
        if (point) setDestCoords(point);
      });
    } catch (err: any) {
      setError("Tracking ID not found or trip has ended.");
    } finally {
      setLoading(false);
    }
  };

  // Real-time Listener
  useEffect(() => {
    if (!trip?.id) return;

    setConnState("connecting");
    const channel = supabase
      .channel(`track-${trip.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "trips",
          filter: `id=eq.${trip.id}`,
        },
        (payload) => {
          setTrip((prev: any) => ({ ...prev, ...payload.new }));
          setLastUpdate(
            payload.new.last_updated
              ? new Date(payload.new.last_updated)
              : null,
          );
        },
      )
      .subscribe((status) => {
        setConnState(
          status === "SUBSCRIBED"
            ? "live"
            : status === "CLOSED"
              ? "offline"
              : "connecting",
        );
      });

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resubscribe only when the trip changes
  }, [trip?.id]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "danger":
        return "bg-destructive text-destructive-foreground animate-pulse";
      case "responding":
        return "bg-amber-600 text-white";
      case "paused":
        return "bg-amber-500 text-white";
      case "completed":
      case "resolved":
        return "bg-blue-600 text-white";
      default:
        return "bg-primary text-primary-foreground";
    }
  };

  // ---- Plain-language copy for anxious, non-technical parents ----
  const firstName = (
    trip?.profiles?.full_name?.split(" ")[0] || "Your traveler"
  ).trim();
  const parentSummary = (() => {
    if (!trip) return "";
    switch (trip.status) {
      case "active":
        return `${firstName} is on the move`;
      case "paused":
        return `${firstName}'s vehicle has stopped`;
      case "danger":
        return `${firstName} pressed the SOS button`;
      case "responding":
        return `Help is on the way for ${firstName}`;
      case "completed":
        return `${firstName} has arrived safely`;
      case "resolved":
        return `All clear — ${firstName} is safe`;
      default:
        return "Trip registered — the journey hasn't started yet";
    }
  })();
  const parentSubLine = !trip
    ? ""
    : trip.status === "paused" && trip.pause_reason
      ? `Reason reported: ${trip.pause_reason}`
      : trip.status === "danger" || trip.status === "responding"
        ? "Security admins monitoring this journey have been alerted automatically. Keep this page open."
        : `${
            lastUpdate
              ? `Last location received ${timeAgo(lastUpdate.toISOString())}`
              : "No GPS fix yet"
          } · Heading to ${trip.destination_state} camp`;

  const showStaleNote =
    trip &&
    ["active", "paused", "danger", "responding"].includes(trip.status) &&
    tripIsStale(trip);

  // Planned route anchor: the live fix once moving, otherwise the state
  // matched from the origin text — so parents see the plan before GPS starts.
  const originCoords = trip ? getOriginPoint(trip) : null;
  const hasLiveFix = trip?.current_lat != null && trip?.current_lng != null;
  const mapAnchor: [number, number] | null = hasLiveFix
    ? [trip.current_lat, trip.current_lng]
    : originCoords;

  // Straight-line distance from the current fix to the planned destination.
  const distanceToDest =
    hasLiveFix && destCoords
      ? getDistanceFromLatLonInKm(
          trip.current_lat,
          trip.current_lng,
          destCoords[0],
          destCoords[1],
        )
      : null;

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      {/* Header */}
      <header className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border sticky top-0 z-[500]">
        <div className="max-w-3xl mx-auto flex items-center justify-between p-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={20} />
            <span className="font-bold text-sm hidden sm:inline">
              Back to Home
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-primary font-bold">
              <Shield size={20} className="fill-primary/20" />
              <span>CorperSafe Tracker</span>
            </div>
            <ThemeSwitcher />
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full p-4 space-y-4">
        {/* Search Bar */}
        <div className="flex gap-2">
          <Input
            value={inputCode}
            onChange={(e) => setInputCode(e.target.value)}
            placeholder="Enter Tracking ID (e.g. NYSC-8291)"
            className="flex-1 h-12 rounded-xl uppercase font-mono"
          />
          <Button
            onClick={() => handleTrack(inputCode)}
            disabled={loading}
            className="h-12 px-6 rounded-xl font-bold flex items-center gap-2"
          >
            {loading ? (
              <span className="animate-spin">⌛</span>
            ) : (
              <Search size={18} />
            )}
            {loading ? "..." : "Track"}
          </Button>
        </div>

        {error && (
          <div className="bg-destructive/10 text-destructive p-4 rounded-xl text-center text-sm font-medium border border-destructive/20 flex items-center gap-2 justify-center">
            <AlertTriangle size={18} />
            {error}
          </div>
        )}

        {trip && (
          <div className="space-y-4 animate-in slide-in-from-bottom duration-500">
            {/* Status Banner */}
            <div
              className={`p-4 rounded-xl shadow-md flex items-center justify-between ${getStatusColor(
                trip.status,
              )}`}
            >
              <div className="flex items-center gap-3">
                {trip.status === "danger" ? (
                  <AlertTriangle size={28} />
                ) : trip.status === "completed" ? (
                  <CheckCircle size={28} />
                ) : (
                  <Navigation size={28} />
                )}
                <div>
                  <h2 className="text-lg font-bold uppercase tracking-wide">
                    {trip.status}
                  </h2>
                  <p className="text-xs opacity-90 flex items-center gap-1">
                    <Clock size={12} />
                    {lastUpdate
                      ? `Last updated: ${lastUpdate.toLocaleTimeString()}`
                      : "Awaiting first location update"}
                  </p>

                  {/* Pause Reason */}
                  {trip.status === "paused" && trip.pause_reason && (
                    <div className="mt-2 bg-white/20 px-2 py-1 rounded text-xs font-bold inline-block">
                      Reason: {trip.pause_reason}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Plain-language summary + live-connection indicator */}
            <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <p className="font-bold text-foreground">{parentSummary}</p>
                <span
                  className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide shrink-0 ${
                    connState === "live" ? "text-success" : "text-warning"
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      connState === "live"
                        ? "bg-success"
                        : "bg-warning animate-pulse"
                    }`}
                  />
                  {connState === "live" ? "Live" : "Connecting…"}
                </span>
              </div>
              {parentSubLine && (
                <p className="text-xs text-muted-foreground mt-1">
                  {parentSubLine}
                </p>
              )}
            </div>

            {/* Stale-signal reassurance — silence is usually poor network,
                not necessarily an emergency */}
            {showStaleNote && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3 text-xs font-medium flex items-start gap-2 dark:bg-amber-950/30 dark:border-amber-900 dark:text-amber-400">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <span>
                  No update for a couple of minutes. On the highway this is
                  usually poor network coverage or a sleeping phone — not
                  automatically an emergency. This page refreshes by itself
                  when the signal returns.
                </span>
              </div>
            )}

            {/* Map View — the traveler may not have a GPS fix yet, but the
                planned route (departure ➔ destination) is always visible */}
            <div className="bg-card p-1 rounded-2xl shadow-sm border border-border h-80 z-0 relative">
              {mapAnchor ? (
                <TrackingMap
                  lat={mapAnchor[0]}
                  lng={mapAnchor[1]}
                  destination={destCoords}
                  origin={originCoords}
                  live={hasLiveFix}
                />
              ) : (
                <div className="h-full w-full flex flex-col items-center justify-center gap-3 rounded-xl bg-muted/40 text-center p-6">
                  <MapPin size={32} className="text-muted-foreground" />
                  <div>
                    <p className="font-bold text-foreground">
                      No location info yet
                    </p>
                    <p className="text-sm text-muted-foreground">
                      The traveler hasn&apos;t started sharing their GPS
                      location, and no departure point was captured at
                      registration. The map will appear once the journey
                      begins.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Details Card */}
            <Card className="rounded-2xl overflow-hidden">
              <CardHeader className="p-4 border-b border-border bg-muted/30">
                <CardTitle className="font-bold text-base flex items-center gap-2">
                  <User size={18} className="text-muted-foreground" />
                  Passenger Details
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="text-xs text-muted-foreground uppercase font-bold">
                    Full Name
                  </label>
                  <p className="text-lg font-medium text-foreground">
                    {trip.profiles?.full_name || "N/A"}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground uppercase font-bold">
                    Vehicle Plate
                  </label>
                  <p className="text-lg font-mono font-bold text-foreground bg-muted inline-block px-2 py-1 rounded">
                    {trip.plate_number || "Not provided"}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground uppercase font-bold">
                    Route
                  </label>
                  <div className="flex items-center gap-2 text-foreground font-medium">
                    <span>{trip.origin}</span>
                    <span className="text-primary">➔</span>
                    <span>{trip.destination_state}</span>
                  </div>
                  {distanceToDest != null && (
                    <p className="text-xs text-muted-foreground mt-1">
                      ≈ {distanceToDest.toFixed(1)} km from the current
                      position to the camp
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-xs text-muted-foreground uppercase font-bold">
                    Emergency Contact
                  </label>
                  <div className="flex items-center gap-2">
                    <Phone size={16} className="text-primary" />
                    <span className="text-foreground">
                      {trip.profiles?.next_of_kin || "N/A"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
