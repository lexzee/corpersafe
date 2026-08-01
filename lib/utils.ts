import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { createClient } from "./supabase/client";
import { toast } from "./toast";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function tripIsStale(trip: any) {
  if (!trip.last_updated) return true;
  const seconds =
    (new Date().getTime() - new Date(trip.last_updated).getTime()) / 1000;
  return seconds > 120; // 2 minutes
}

// Sanitize a post-login redirect target — same-origin paths only, never
// protocol-relative URLs (prevents open redirects via ?next=evil.com).
export function safeNextPath(value: string | null | undefined) {
  if (!value) return null;
  return value.startsWith("/") && !value.startsWith("//") ? value : null;
}

// Roles with access to the admin monitoring dashboard. Keep in sync with the
// profiles.role enum / the is_admin() SQL helper.
export const ADMIN_ROLES = [
  "admin",
  "super_admin",
  "state_admin",
  "school_admin",
] as const;

export function isAdminRole(role: string | null | undefined) {
  return !!role && (ADMIN_ROLES as readonly string[]).includes(role);
}

// Parents type tracking codes every possible way: "53198", "nysc 53198",
// "NYSC53198", "NYSC-53198". Normalise to the stored "NYSC-#####" form;
// returns "" when nothing usable was entered.
export function normalizeTrackingCode(raw: string | null | undefined) {
  const compact = (raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  const id = compact.replace(/^NYSC-?/, "");
  return id ? `NYSC-${id}` : "";
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

export const runSafetyCheck = async (
  silent = false,
  enableAudio?: () => void,
  setLoading?: (value: React.SetStateAction<boolean>) => void,
  setTrips?: (value: React.SetStateAction<any[]>) => void,
  notify?: (message: string, kind?: "info" | "success" | "warning" | "error") => void,
) => {
  const supabase = createClient();
  enableAudio?.();
  if (!silent) setLoading?.(true);
  const { data, error } = await supabase.rpc("check_signal_loss");

  if (!silent) {
    if (error) {
      console.error("Safety Check Failed:", error);
      notify?.(
        "Safety check failed — check the browser console for details.",
        "error",
      );
    } else {
      const { newly_flagged, total_danger } = data as {
        newly_flagged: number;
        total_danger: number;
      };

      if (newly_flagged > 0) {
        notify?.(
          `${newly_flagged} new signal${newly_flagged > 1 ? "s" : ""} lost. Trips currently in danger: ${total_danger}.`,
          "error",
        );
      } else if (total_danger > 0) {
        notify?.(
          `Scan complete — no NEW lost signals.\n${total_danger} trip${total_danger > 1 ? "s are" : " is"} still in danger.`,
          "warning",
        );
      } else {
        notify?.("Scan complete — all signals are fresh.", "success");
      }
    }
  }

  // Refetch data to update UI
  const { data: newData } = await supabase
    .from("trips")
    .select("*, profiles(full_name, phone, next_of_kin)")
    .neq("status", "completed")
    .neq("status", "resolved");
  if (newData) setTrips?.(newData);
  setLoading?.(false);
};

export const copyCode = (tracking_code: string) => {
  navigator.clipboard.writeText(tracking_code);
  toast("Tracking code copied!", "success");
};

export const shareCode = async (tracking_code: string) => {
  // Include the code in the URL so the recipient opens the live map
  // directly instead of having to type the code manually.
  const url = `${window.location.origin}/track?code=${encodeURIComponent(tracking_code)}`;
  if (navigator.share) {
    try {
      await navigator.share({
        title: "Track my NYSC Journey",
        text: `I'm on my way to camp. Track my journey live: ${url}`,
        url,
      });
    } catch (err) {
      // Share cancelled — no action needed
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
  options?: { navigateOnComplete?: boolean },
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

  // Navigation is opt-out: the "Arrived" undo flow defers to the parent
  // dashboard, which reacts to the completed status itself.
  if (status === "completed" && options?.navigateOnComplete !== false) {
    try {
      if (typeof window !== "undefined") {
        window.location.href = "/pcm";
        window.location.reload();
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
