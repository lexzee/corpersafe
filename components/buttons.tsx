"use client";

import { copyCode, shareCode, updateStatus } from "@/lib/utils";
import {
  CheckCircle,
  Clipboard,
  Clock,
  Loader2,
  Navigation,
  PlayCircle,
  RefreshCw,
  Share2,
  StopCircle,
  Users,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export function CopyButton({ code }: { code: string }) {
  return (
    <button
      onClick={() => copyCode(code)}
      aria-label="Copy tracking code"
      className="bg-background p-2 rounded-lg text-primary shadow-sm active:scale-95 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Clipboard size={18} />
    </button>
  );
}

export function ShareButton({ code }: { code: string }) {
  return (
    <button
      onClick={() => shareCode(code)}
      aria-label="Share tracking link"
      className="bg-background p-2 rounded-lg text-primary shadow-sm active:scale-95 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Share2 size={18} />
    </button>
  );
}

export function ViewHistoryButton() {
  // NOTE: next/navigation's redirect() throws and cannot be used inside
  // client-side event handlers — use useRouter().push() instead.
  const router = useRouter();
  return (
    <button
      onClick={() => router.push("/history")}
      className="mt-4 text-muted-foreground text-sm hover:text-foreground"
    >
      View History
    </button>
  );
}

export function PauseResumeButton({
  status,
  handlePauseClick,
}: {
  status: string;
  handlePauseClick: () => void;
}) {
  return (
    <button
      onClick={handlePauseClick}
      className={`p-4 rounded-xl flex flex-col items-center justify-center gap-2 font-bold transition border-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        status === "paused"
          ? "bg-card border-primary/20 text-primary shadow-sm"
          : "bg-warning/10 border-warning/20 text-warning shadow-sm"
      }`}
    >
      {status === "paused" ? <Navigation size={24} /> : <Clock size={24} />}
      {status === "paused" ? "Resume Manual" : "Report Stop"}
    </button>
  );
}

/**
 * Completing a trip is irreversible from the traveler's side, so this is a
 * two-stage flow: a confirmation sheet, then a short undo window. Nothing
 * is written to the database until the undo window expires, so watchers
 * never see a false "completed" flip.
 */
export function ArrivedButton({ trip, currentLoc, setTrip }: any) {
  const UNDO_SECONDS = 8;
  const [confirming, setConfirming] = useState(false);
  const [undoLeft, setUndoLeft] = useState<number | null>(null);
  const [finishing, setFinishing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  useEffect(() => clearTimer, []);

  const startUndoWindow = () => {
    setConfirming(false);
    setUndoLeft(UNDO_SECONDS);
    timerRef.current = setInterval(() => {
      setUndoLeft((s) => {
        if (s === null || s <= 1) {
          clearTimer();
          void finalize();
          return null;
        }
        return s - 1;
      });
    }, 1000);
  };

  const finalize = async () => {
    clearTimer();
    setUndoLeft(null);
    setFinishing(true);
    // navigateOnComplete: false — the parent dashboard reacts to the
    // completed status and swaps views itself.
    await updateStatus("completed", null, trip, setTrip, currentLoc, {
      navigateOnComplete: false,
    });
    setFinishing(false);
  };

  const undo = () => {
    clearTimer();
    setUndoLeft(null);
  };

  return (
    <>
      <button
        onClick={() => setConfirming(true)}
        disabled={finishing}
        className="bg-primary border-2 border-primary text-primary-foreground p-4 rounded-xl flex flex-col items-center justify-center gap-2 font-bold hover:bg-primary/90 transition shadow-md shadow-primary/20 active:scale-95 disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {finishing ? (
          <Loader2 size={24} className="animate-spin" />
        ) : (
          <CheckCircle size={24} />
        )}
        Arrived
      </button>

      {/* Stage 1: explicit confirmation */}
      {confirming && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="arrive-title"
            className="bg-card w-full max-w-sm rounded-2xl p-6 animate-in slide-in-from-bottom-10 duration-300 border border-border shadow-2xl"
          >
            <h3 id="arrive-title" className="text-lg font-bold text-card-foreground">
              Mark trip as completed?
            </h3>
            <p className="text-sm text-muted-foreground mt-1 mb-5">
              Only do this once you&apos;ve arrived at camp. It ends live
              tracking for everyone watching your journey.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirming(false)}
                className="flex-1 py-3 rounded-xl font-bold bg-muted hover:bg-muted/70 transition"
              >
                Not yet
              </button>
              <button
                onClick={startUndoWindow}
                className="flex-1 py-3 rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition active:scale-95"
              >
                Yes, arrived
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stage 2: undo window (DB is not written until this expires) */}
      {undoLeft !== null && (
        <div className="fixed bottom-6 inset-x-4 sm:left-1/2 sm:-translate-x-1/2 sm:max-w-sm z-50 bg-card border border-border shadow-2xl rounded-xl p-4 flex items-center gap-3 animate-in slide-in-from-bottom-4">
          <CheckCircle className="text-success shrink-0" size={20} />
          <p className="text-sm font-medium flex-1">
            Ending trip in {undoLeft}s…
          </p>
          <button
            onClick={() => void finalize()}
            className="text-xs font-bold text-muted-foreground underline"
          >
            End now
          </button>
          <button
            onClick={undo}
            className="shrink-0 bg-primary text-primary-foreground text-xs font-bold px-3 py-2 rounded-lg active:scale-95 transition"
          >
            Undo
          </button>
        </div>
      )}
    </>
  );
}

export function MuteButton({
  isMuted,
  setIsMuted,
}: {
  isMuted: boolean;
  setIsMuted: (muted: boolean) => void;
}) {
  return (
    <button
      onClick={() => setIsMuted(!isMuted)}
      aria-label={isMuted ? "Unmute alarm" : "Mute alarm"}
      className="p-2 text-muted-foreground hover:text-foreground rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
    </button>
  );
}

export function DemoButton({
  generateDemoData,
  armed = false,
  demoActive = false,
  onStopDemo,
}: {
  generateDemoData: () => void;
  armed?: boolean;
  demoActive?: boolean;
  onStopDemo?: () => void;
}) {
  const handleClick = demoActive ? onStopDemo : generateDemoData;
  return (
    <button
      onClick={handleClick}
      aria-label={
        demoActive ? "Remove all demo trips" : "Simulate demo traffic"
      }
      title={
        demoActive
          ? "Remove all demo trips (tap twice)"
          : "Generate 5 demo trips (tap twice)"
      }
      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold active:scale-95 transition shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        demoActive
          ? "bg-destructive text-destructive-foreground shadow-destructive/20 hover:bg-destructive/90"
          : "bg-primary text-primary-foreground shadow-primary/20 hover:bg-primary/90"
      } ${armed ? "ring-2 ring-primary-foreground/70 animate-pulse" : ""}`}
    >
      {demoActive ? <StopCircle size={16} /> : <PlayCircle size={16} />}
      <span className="hidden sm:inline">
        {armed ? "Tap to Confirm" : demoActive ? "Stop Demo" : "Simulate"}
      </span>
    </button>
  );
}

export function SafetyCheckButton({ runSafetyCheck, loading }: any) {
  return (
    <button
      onClick={() => runSafetyCheck(false)}
      aria-label="Run dead-man's-switch signal check"
      className="flex items-center gap-2 px-3 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm font-bold hover:bg-border border border-border active:scale-95 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      title="Run Dead Man Switch Check"
    >
      <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
    </button>
  );
}

export function ManageStaffButton() {
  const router = useRouter();
  // TODO: "/users" does not exist yet — build the staff-management page
  // before enabling this button in the AdminNavbar.
  return (
    <button
      onClick={() => router.push("/users")}
      className="flex items-center gap-2 px-3 py-2 bg-background text-foreground rounded-lg text-sm font-bold hover:bg-muted border border-border"
      title="Manage Staff"
    >
      <Users size={16} />
      <span className="hidden sm:inline">Staff</span>
    </button>
  );
}
