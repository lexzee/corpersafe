"use client";

import { copyCode, shareCode, updateStatus } from "@/lib/utils";
import {
  CheckCircle,
  Clipboard,
  Clock,
  Navigation,
  Share2,
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
