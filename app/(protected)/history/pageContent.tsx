"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  ArrowLeft,
  Clock,
  Calendar,
  ChevronRight,
  Loader2,
  CheckCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const HistoryMap = dynamic(() => import("./HistoryMap"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-muted rounded-xl text-muted-foreground">
      Loading Map...
    </div>
  ),
});

export default function HistoryContent() {
  const supabase = createClient();
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [trips, setTrips] = useState<any[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<any>(null);
  const [routePath, setRoutePath] = useState<[number, number][]>([]);
  const [loading, setLoading] = useState(true);

  // 1. Fetch User
  useEffect(() => {
    const fetchUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) setUser(user);
      // else router.push("/auth/login");
    };
    fetchUser();
  }, []);

  // 2. Fetch Completed Trips
  useEffect(() => {
    if (!user) return;
    const fetchHistory = async () => {
      const { data, error } = await supabase
        .from("trips")
        .select("*")
        .eq("pcm_id", user.id)
        .eq("status", "completed")
        .order("created_at", { ascending: false });

      if (error) console.error(error);
      if (data) setTrips(data);
      setLoading(false);
    };
    fetchHistory();
  }, [user]);

  // 3. Fetch Route Logs when a trip is selected
  const handleSelectTrip = async (trip: any) => {
    setSelectedTrip(trip);
    // Fetch logs
    const { data } = await supabase
      .from("trip_logs")
      .select("lat, lng")
      .eq("trip_id", trip.id)
      .order("recorded_at", { ascending: true });

    if (data) {
      // Convert to array of [lat, lng]
      const path = data.map(
        (log: any) => [log.lat, log.lng] as [number, number],
      );
      // Add start and current(end) points to ensure complete line
      if (trip.current_lat) path.push([trip.current_lat, trip.current_lng]);

      setRoutePath(path);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  if (loading)
    return (
      <div className="flex h-screen items-center justify-center bg-muted/30">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );

  // --- DETAIL VIEW (Map) ---
  if (selectedTrip) {
    return (
      <div className="flex flex-col h-screen bg-muted/30">
        <header className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border sticky top-0 z-10">
          <div className="max-w-md mx-auto flex items-center justify-between p-4">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedTrip(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft size={24} />
              </Button>
              <div>
                <h1 className="font-bold text-foreground">
                  {selectedTrip.destination_state} Trip
                </h1>
                <p className="text-xs text-muted-foreground">
                  {formatDate(selectedTrip.created_at)}
                </p>
              </div>
            </div>
            <ThemeSwitcher />
          </div>
        </header>

        <div className="flex-1 relative z-0">
          <HistoryMap routePath={routePath} />

          {/* Info Overlay */}
          <Card className="absolute bottom-4 left-4 right-4 z-[400] shadow-lg">
            <CardContent className="p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-muted-foreground uppercase">
                  Vehicle
                </span>
                <span className="font-mono font-bold text-foreground">
                  {selectedTrip.plate_number}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-muted-foreground uppercase">
                  Status
                </span>
                <span className="bg-green-500/10 text-green-600 px-2 py-1 rounded text-xs font-bold flex items-center gap-1 border border-green-500/20">
                  <CheckCircle size={12} /> Completed Safely
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // --- LIST VIEW ---
  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      <header className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border sticky top-0 z-10">
        <div className="max-w-md mx-auto flex items-center justify-between p-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/pcm")}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft size={24} />
            </Button>
            <h1 className="text-xl font-bold text-foreground">Trip History</h1>
          </div>
          <ThemeSwitcher />
        </div>
      </header>

      <main className="max-w-md mx-auto w-full p-4 space-y-4">
        {trips.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Clock size={48} className="mx-auto mb-4 opacity-20" />
            <p>No completed trips yet.</p>
          </div>
        ) : (
          trips.map((trip) => (
            <Card
              key={trip.id}
              onClick={() => handleSelectTrip(trip)}
              className="cursor-pointer hover:bg-muted/50 transition-colors"
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="bg-primary/10 p-3 rounded-full text-primary">
                    <CheckCircle size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground">
                      {trip.destination_state}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                      <Calendar size={12} />
                      <span>{formatDate(trip.created_at)}</span>
                      <span>•</span>
                      <span className="font-mono">{trip.plate_number}</span>
                    </div>
                  </div>
                </div>
                <ChevronRight className="text-muted-foreground" />
              </CardContent>
            </Card>
          ))
        )}
      </main>
    </div>
  );
}
