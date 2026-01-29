import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { createClient } from "./supabase/client";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function tripIsStale(trip: any) {
  if (!trip.last_updated) return true;
  const seconds =
    (new Date().getTime() - new Date(trip.last_updated).getTime()) / 1000;
  return seconds > 120; // 2 minutes
}

export function timeAgo(dateString: string) {
  const seconds = Math.floor(
    (new Date().getTime() - new Date(dateString).getTime()) / 1000,
  );
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

export const copyCode = (tracking_code: string) => {
  navigator.clipboard.writeText(tracking_code);
  alert("Tracking code copied!");
};

export const shareCode = async (tracking_code: string) => {
  if (navigator.share) {
    try {
      await navigator.share({
        title: "Track my NYSC Journey",
        text: `I'm on my way to camp. Track me here: ${tracking_code}`,
        url: window.location.origin + "/track",
      });
    } catch (err) {
      console.log("Share cancelled");
    }
  } else {
    // Fallback
    copyCode(tracking_code);
  }
};

export const updateStatus = async (
  status: string,
  reason: string | null = null,
  trip: any,
  setTrip: (value: React.SetStateAction<any>) => void,
  Location: [number, number],
) => {
  const supabase = createClient();
  if (!trip) return;
  // Optimistic UI update
  setTrip({ ...trip, status });

  const updatePayload: any = {
    status,
    last_updated: new Date().toISOString(),
    pause_reason: null,
  };
  if (reason) updatePayload.pause_reason = reason;
  if (status === "active") updatePayload.pause_reason = null;

  setTrip((prev: any) => ({ ...prev, ...updatePayload }));

  await supabase.from("trips").update(updatePayload).eq("id", trip.id);

  await supabase.from("trip_logs").insert({
    trip_id: trip.id,
    lat: Location[0],
    lng: Location[1],
    status_at_time: trip.status,
  });

  // Avoid calling React hooks from helpers. Use history API so client-side
  // router can respond; fall back to full navigation if necessary.
  if (status === "completed") {
    try {
      if (typeof window !== "undefined") {
        window.history.pushState({}, "", "/");
        window.dispatchEvent(new PopStateEvent("popstate"));
      }
    } catch (e) {
      if (typeof window !== "undefined") window.location.href = "/";
    }
  }
};

// --- HELPER: Calculate Distance (Haversine Formula) ---
// Used to calculate speed if the browser doesn't provide it directly
function deg2rad(deg: number) {
  return deg * (Math.PI / 180);
}
export function getDistanceFromLatLonInKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
