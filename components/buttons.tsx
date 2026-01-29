"use client";

import { copyCode, shareCode, updateStatus } from "@/lib/utils";
import {
  CheckCircle,
  Clipboard,
  Clock,
  Navigation,
  PlayCircle,
  RefreshCw,
  Share2,
  Users,
  Volume2,
  VolumeX,
} from "lucide-react";
import { redirect } from "next/navigation";

export function CopyButton({ code }: { code: string }) {
  return (
    <button
      onClick={() => copyCode(code)}
      className="bg-background p-2 rounded-lg text-primary shadow-sm active:scale-95 transition"
    >
      <Clipboard size={18} />
    </button>
  );
}

export function ShareButton({ code }: { code: string }) {
  return (
    <button
      onClick={() => shareCode(code)}
      className="bg-background p-2 rounded-lg text-primary shadow-sm active:scale-95 transition"
    >
      <Share2 size={18} />
    </button>
  );
}

export function ViewHistoryButton() {
  // const router = useRouter();
  return (
    <button
      onClick={() => redirect("/history")}
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
      className={`p-4 rounded-xl flex flex-col items-center justify-center gap-2 font-bold transition border-2 ${
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

export function ArrivedButton({ trip, currentLoc, setTrip }: any) {
  return (
    <button
      onClick={() => updateStatus("completed", null, trip, setTrip, currentLoc)}
      className="bg-primary border-2 border-primary text-primary-foreground p-4 rounded-xl flex flex-col items-center justify-center gap-2 font-bold hover:bg-primary/90 transition shadow-md shadow-primary/20 active:scale-95"
    >
      <CheckCircle size={24} /> Arrived
    </button>
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
      className="p-2 text-muted-foreground hover:text-foreground"
    >
      {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
    </button>
  );
}

export function DemoButton({
  generateDemoData,
}: {
  generateDemoData: () => void;
}) {
  return (
    <button
      onClick={generateDemoData}
      className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-bold hover:bg-primary/90 active:scale-95 transition shadow-lg shadow-primary/20"
    >
      <PlayCircle size={16} />
      <span className="hidden sm:inline">Simulate</span>
    </button>
  );
}

export function SafetyCheckButton({ runSafetyCheck, loading }: any) {
  return (
    <button
      onClick={() => runSafetyCheck(false)}
      className="flex items-center gap-2 px-3 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm font-bold hover:bg-border border border-border active:scale-95 transition"
      title="Run Dead Man Switch Check"
    >
      <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
    </button>
  );
}

export function ManageStaffButton() {
  return (
    <button
      onClick={() => redirect("/users")}
      className="flex items-center gap-2 px-3 py-2 bg-background text-foreground rounded-lg text-sm font-bold hover:bg-muted border border-border"
      title="Manage Staff"
    >
      <Users size={16} />
      <span className="hidden sm:inline">Staff</span>
    </button>
  );
}
