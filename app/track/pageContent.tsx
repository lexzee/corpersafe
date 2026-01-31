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
} from "lucide-react";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
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
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    if (urlCode) handleTrack(urlCode);
  }, [urlCode]);

  // Initial Search Handler
  const handleTrack = async (codeToTrack: string) => {
    if (!codeToTrack) return;
    setLoading(true);
    setError("");
    setTrip(null);

    try {
      // 1. Fetch Trip Data + Driver/PCM Info
      const cleanCode = codeToTrack.trim().toUpperCase();
      const { data, error } = await supabase
        .from("trips")
        .select("*, profiles(full_name, phone, next_of_kin)")
        .eq("tracking_code", cleanCode)
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error("Tracking ID not found or trip has ended.");
      setTrip(data);
      setLastUpdate(new Date(data.last_updated));
    } catch (err: any) {
      setError("Tracking ID not found or trip has ended.");
    } finally {
      setLoading(false);
    }
  };

  // Real-time Listener
  useEffect(() => {
    if (!trip?.id) return;

    console.log(`Subscribing to updates for trip ${trip.id}...`);
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
          console.log("Live Update:", payload.new);
          setTrip((prev: any) => ({ ...prev, ...payload.new }));
          setLastUpdate(new Date(payload.new.last_updated));
        },
      )
      .subscribe((status) => {
        console.log("Subscription Status: ", status);
      });

    return () => {
      console.log("Unsubscribing...");
      supabase.removeChannel(channel);
    };
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "danger":
        return "bg-destructive text-destructive-foreground animate-pulse";
      case "paused":
        return "bg-amber-500 text-white";
      case "completed":
        return "bg-blue-600 text-white";
      default:
        return "bg-primary text-primary-foreground";
    }
  };
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
                    <Clock size={12} /> Last updated:{" "}
                    {lastUpdate.toLocaleTimeString()}
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

            {/* Map View */}
            <div className="bg-card p-1 rounded-2xl shadow-sm border border-border h-80 z-0 relative">
              <TrackingMap lat={trip.current_lat} lng={trip.current_lng} />
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
                    {trip.plate_number}
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
