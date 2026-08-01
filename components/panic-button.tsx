"use client";

import { sendEmergencyEmail } from "@/lib/email";
import { createClient } from "@/lib/supabase/client";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const HOLD_MS = 3000; // press-and-hold duration before the SOS arms
const UNDO_SECONDS = 5; // undo window after a successful hold
const CANCEL_CONFIRM_MS = 4000; // two-step "I'm safe" confirmation timeout
const RING_R = 30;
const RING_C = 2 * Math.PI * RING_R;

type Phase = "idle" | "holding" | "countdown" | "sending" | "sos_active";

/**
 * Emergency SOS control.
 *
 * Interactions are deliberately deliberate: press-and-hold for 3s to arm,
 * then a 5s undo window before the alert is committed to the database and
 * emailed to the next-of-kin. Once active, a persistent banner offers a
 * (two-step) "I'm safe" cancellation that restores the previous status.
 */
export default function PanicButton({
  trip,
  setTrip,
}: {
  trip: any;
  setTrip: (value: any) => void;
}) {
  const supabase = createClient();

  const [phase, setPhase] = useState<Phase>(
    trip?.status === "danger" ? "sos_active" : "idle",
  );
  const [countdown, setCountdown] = useState(UNDO_SECONDS);
  const [emailNote, setEmailNote] = useState<string | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelConfirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevStatusRef = useRef<string>("active");
  // Never arm twice while one commit is in flight
  const committingRef = useRef(false);

  // Clear pending timers on unmount
  useEffect(() => {
    return () => {
      if (holdTimer.current) clearTimeout(holdTimer.current);
      if (countdownTimer.current) clearInterval(countdownTimer.current);
      if (cancelConfirmTimer.current) clearTimeout(cancelConfirmTimer.current);
    };
  }, []);

  // If this trip enters danger from another device/tab, reflect it here
  useEffect(() => {
    if (trip?.status === "danger") {
      setPhase((p) => (p === "sending" || p === "sos_active" ? p : "sos_active"));
    }
  }, [trip?.status]);

  const vibrate = (pattern: number | number[]) => {
    try {
      (navigator as any).vibrate?.(pattern);
    } catch {
      // Haptics unsupported — ignore
    }
  };

  /* ---------------- Hold to arm ---------------- */

  const startHold = () => {
    if (phase !== "idle" || committingRef.current) return;
    setPhase("holding");
    setEmailNote(null);
    vibrate(50);
    holdTimer.current = setTimeout(() => {
      holdTimer.current = null;
      // Start the undo countdown
      setPhase("countdown");
      setCountdown(UNDO_SECONDS);
      vibrate([80, 40, 80]);
      countdownTimer.current = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) {
            if (countdownTimer.current) clearInterval(countdownTimer.current);
            countdownTimer.current = null;
            void commitSOS();
            return 0;
          }
          return c - 1;
        });
      }, 1000);
    }, HOLD_MS);
  };

  const releaseHold = () => {
    if (phase !== "holding") return;
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = null;
    setPhase("idle");
  };

  const cancelCountdown = () => {
    if (phase !== "countdown") return;
    if (countdownTimer.current) clearInterval(countdownTimer.current);
    countdownTimer.current = null;
    setPhase("idle");
  };

  /* ---------------- Commit / Cancel SOS ---------------- */

  const commitSOS = async () => {
    if (committingRef.current) return;
    committingRef.current = true;
    prevStatusRef.current =
      trip?.status && trip.status !== "danger" ? trip.status : "active";
    setPhase("sending");

    try {
      const { error: updateError } = await supabase
        .from("trips")
        .update({
          status: "danger",
          last_updated: new Date().toISOString(),
        })
        .eq("id", trip.id);
      if (updateError) throw updateError;

      setTrip((prev: any) => ({ ...prev, status: "danger" }));
      setPhase("sos_active");
      vibrate([150, 50, 150]);

      // Notify next-of-kin by email (best-effort — the admin flag is live
      // even if the email fails)
      const { data: fullTrip } = await supabase
        .from("trips")
        .select("*, profiles(full_name, next_of_kin_email)")
        .eq("id", trip.id)
        .single();

      if (fullTrip?.profiles?.next_of_kin_email) {
        const link = `${window.location.origin}/track?code=${fullTrip.tracking_code}`;
        const res = await sendEmergencyEmail(
          fullTrip.id,
          fullTrip.profiles.next_of_kin_email,
          fullTrip.profiles.full_name,
          link,
          fullTrip.plate_number,
        );
        setEmailNote(
          res.success
            ? "Alert email sent to your next of kin."
            : "Email alert failed — but the SOS flag is live on the admin dashboard.",
        );
      } else {
        setEmailNote(
          "No next-of-kin email on file — SOS flag is live on the admin dashboard.",
        );
      }
    } catch (e) {
      console.error(e);
      setPhase("idle");
      setEmailNote("Network error — the SOS was not sent. Please try again.");
    } finally {
      committingRef.current = false;
    }
  };

  const handleCancelClick = () => {
    // Step 1: ask for confirmation
    if (!confirmingCancel) {
      setConfirmingCancel(true);
      cancelConfirmTimer.current = setTimeout(
        () => setConfirmingCancel(false),
        CANCEL_CONFIRM_MS,
      );
      return;
    }
    // Step 2: confirmed
    if (cancelConfirmTimer.current) clearTimeout(cancelConfirmTimer.current);
    setConfirmingCancel(false);
    void cancelSOS();
  };

  const cancelSOS = async () => {
    const restore = prevStatusRef.current || "active";
    try {
      const { error } = await supabase
        .from("trips")
        .update({
          status: restore,
          last_updated: new Date().toISOString(),
        })
        .eq("id", trip.id);
      if (error) throw error;
      setTrip((prev: any) => ({ ...prev, status: restore }));
      setPhase("idle");
      setEmailNote("False alarm cancelled. Stay safe.");
    } catch (e) {
      console.error(e);
      setEmailNote("Could not cancel the alert — check your connection.");
    }
  };

  /* ---------------- Render ---------------- */

  // Persistent banner while an SOS is live
  if (phase === "sos_active") {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-destructive text-destructive-foreground border-t-4 border-destructive-foreground/30 shadow-2xl animate-in slide-in-from-bottom">
        <div className="max-w-md mx-auto flex items-center gap-3 px-4 py-3">
          <span className="relative flex h-3 w-3 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive-foreground opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-destructive-foreground"></span>
          </span>
          <div className="flex-1 min-w-0">
            <p className="font-black text-sm uppercase tracking-wide">
              SOS Active
            </p>
            <p className="text-[11px] opacity-90 truncate">
              {emailNote ?? "Help has been alerted."}
            </p>
          </div>
          <button
            type="button"
            onClick={handleCancelClick}
            className="shrink-0 bg-destructive-foreground text-destructive text-xs font-bold px-3 py-2 rounded-lg active:scale-95 transition"
          >
            {confirmingCancel ? "Tap again to confirm" : "I'm Safe — Cancel"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
      {/* Undo window */}
      {phase === "countdown" && (
        <button
          type="button"
          onClick={cancelCountdown}
          className="bg-amber-500 text-white text-sm font-bold px-4 py-2.5 rounded-full shadow-xl animate-in slide-in-from-bottom flex items-center gap-2 active:scale-95 transition"
        >
          <span className="font-mono">{countdown}s</span> Cancel SOS
        </button>
      )}

      {/* One-off note (e.g. previous send failure / cancellation) */}
      {phase === "idle" && emailNote && (
        <div className="max-w-[230px] text-right bg-card text-card-foreground text-xs font-medium px-3 py-2 rounded-lg shadow-xl border border-border">
          {emailNote}
        </div>
      )}

      <button
        type="button"
        aria-label="Emergency SOS — press and hold for 3 seconds"
        onPointerDown={startHold}
        onPointerUp={releaseHold}
        onPointerLeave={releaseHold}
        onPointerCancel={releaseHold}
        onContextMenu={(e) => e.preventDefault()}
        disabled={phase === "sending"}
        className={`relative touch-none select-none bg-destructive text-destructive-foreground rounded-full p-6 w-24 h-24 shadow-2xl border-4 border-destructive-foreground/30 flex flex-col items-center justify-center active:scale-95 transition-transform disabled:bg-muted disabled:text-muted-foreground disabled:border-border ${
          phase === "idle" ? "animate-pulse" : ""
        }`}
      >
        {/* Hold progress ring */}
        <svg
          className="absolute inset-0 h-full w-full -rotate-90 pointer-events-none"
          viewBox="0 0 80 80"
          aria-hidden="true"
        >
          <circle
            cx="40"
            cy="40"
            r={RING_R}
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={RING_C}
            strokeDashoffset={phase === "holding" ? 0 : RING_C}
            style={{
              transition:
                phase === "holding"
                  ? `stroke-dashoffset ${HOLD_MS}ms linear`
                  : "stroke-dashoffset 200ms ease-out",
            }}
          />
        </svg>

        {phase === "sending" ? (
          <Loader2 className="animate-spin" size={32} />
        ) : (
          <>
            <AlertTriangle size={32} />
            <span className="text-xs font-black uppercase mt-1">SOS</span>
          </>
        )}
      </button>
      <span className="text-[10px] font-bold text-muted-foreground bg-background/80 rounded px-1">
        Hold 3s
      </span>
    </div>
  );
}
