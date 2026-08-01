import {
  AlertTriangle,
  Car,
  Loader2,
  Moon,
  Play,
  Shield,
  Utensils,
  Wrench,
  X,
} from "lucide-react";
import { CopyButton, ShareButton, ViewHistoryButton } from "./buttons";
import { LogoutButton } from "./logout-button";
import { Input } from "./ui/input";

export const TripStatus = ({
  trip,
  setShowPauseModal,
}: {
  trip: any;
  setShowPauseModal: React.SetStateAction<any>;
}) => {
  if (trip.status === "active")
    return (
      <div className="bg-success/10 border-l-4 border-success p-4 rounded-r shadow-sm">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-xs font-bold text-success uppercase">
              Vehicle Active
            </p>
          </div>
        </div>
      </div>
    );
  if (trip.status === "paused")
    return (
      <div className="bg-warning/10 border-l-4 border-warning p-4 rounded-r shadow-sm">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-xs font-bold text-warning uppercase">
              Vehicle Stopped
            </p>
            <p className="font-bold text-foreground">
              {trip.pause_reason || "No reason provided"}
            </p>
          </div>
          <button
            onClick={() => setShowPauseModal(true)}
            className="text-xs text-blue-600 underline"
          >
            Edit Reason
          </button>
        </div>
      </div>
    );
  if (trip.status === "danger")
    return (
      // <div className="px-3 py-1 rounded-full text-xs font-bold uppercase bg-red-100 text-red-700">
      <div className="bg-destructive/10 border-l-4 border-destructive p-4 rounded-r shadow-sm uppercase text-destructive font-bold">
        Vehicle in danger
      </div>
    );
};

export const TripPending = ({
  trip,
  handleStartTrip,
  starting,
  plateNumber,
  setPlateNumber,
}: {
  trip: any;
  handleStartTrip: () => void;
  starting: boolean;
  plateNumber: string;
  setPlateNumber: (value: string) => void;
}) => {
  return (
    <div className="min-h-screen bg-muted/30 flex flex-col items-center justify-center p-6 text-center">
      {/* Log out straight from the pending-trip screen */}
      <div className="absolute top-4 right-4">
        <LogoutButton />
      </div>
      <div className="bg-card p-8 rounded-2xl shadow-xl max-w-sm w-full border border-border">
        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <Car size={40} className="text-primary" />
        </div>

        <h1 className="text-2xl font-bold text-card-foreground mb-2">
          Trip Registered
        </h1>
        <p className="text-muted-foreground mb-6">
          You are set to travel to <strong>{trip.destination_state}</strong>.{" "}
          <br />
          Once you&apos;re seated in the vehicle, add the plate number below
          and tap START JOURNEY — your family can then follow you live.
        </p>

        <div className="bg-muted/50 p-4 rounded-xl border border-border mb-6 text-left">
          <div className="flex justify-between mb-2">
            <span className="text-xs font-bold text-muted-foreground uppercase">
              Vehicle
            </span>
            <span className="font-mono font-bold text-foreground">
              {plateNumber || trip.plate_number || "Not provided"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase">
              Tracking ID
            </span>
            <span className="font-mono font-bold text-foreground">
              {trip.tracking_code}
            </span>
          </div>
        </div>

        {/* Plate number — collected at boarding time, when the traveler
            actually knows the vehicle they're in. No registry verification. */}
        <div className="text-left mb-6">
          <label
            htmlFor="plateNumber"
            className="text-xs font-bold text-muted-foreground uppercase"
          >
            Vehicle plate number{" "}
            <span className="normal-case font-medium">(add when you board)</span>
          </label>
          <Input
            id="plateNumber"
            value={plateNumber}
            onChange={(e) => setPlateNumber(e.target.value.toUpperCase())}
            placeholder="e.g. ABC-123-XY"
            maxLength={15}
            className="mt-1 font-mono uppercase"
          />
          <p className="text-[10px] text-muted-foreground mt-1">
            Included in SOS alerts and on your admin watch-card. You can start
            without it, but it helps responders find your vehicle.
          </p>
        </div>

        <button
          onClick={handleStartTrip}
          disabled={starting}
          className="w-full bg-primary text-primary-foreground py-4 rounded-xl font-bold text-lg shadow-lg shadow-primary/20 hover:bg-primary/90 transition flex items-center justify-center gap-2 active:scale-95 duration-300"
        >
          {starting ? (
            <Loader2 className="animate-spin" />
          ) : (
            <Play fill="currentColor" />
          )}{" "}
          START JOURNEY
        </button>

        <ViewHistoryButton />
      </div>
    </div>
  );
};

export const TrackingID = ({ tracking_code }: { tracking_code: string }) => {
  return (
    <div className="bg-accent/20 rounded-xl p-3 flex items-center justify-between border border-accent/20 mb-4">
      <div className="font-bold">
        <p className="text-[10px] text-accent uppercase">Tracking ID</p>
        <p className="font-mono text-lg text-primary tracking-wider">
          {tracking_code}
        </p>
      </div>

      <div className="flex gap-4">
        <CopyButton code={tracking_code} />
        <ShareButton code={tracking_code} />
      </div>
    </div>
  );
};

export const PauseModal = ({
  setShowPauseModal,
  confirmPause,
}: {
  setShowPauseModal: (show: boolean) => void;
  confirmPause: (reason: string) => void;
}) => {
  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-card w-full max-w-sm rounded-2xl p-6 animate-in slide-in-from-bottom-10 duration-300 border border-border shadow-2xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-card-foreground">
            Why are you stopping?
          </h3>
          <button
            onClick={() => setShowPauseModal(false)}
            aria-label="Close"
            className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X size={24} className="text-muted-foreground" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            {
              reason: "Buying Food / Refreshment",
              label: "Food / Eat",
              icon: <Utensils size={24} className="text-blue-500" />,
            },
            {
              reason: "Traffic / Go Slow",
              label: "Traffic",
              icon: <Car size={24} className="text-orange-500" />,
            },
            {
              reason: "Vehicle Repair / Fault",
              label: "Repair",
              icon: <Wrench size={24} className="text-slate-500" />,
            },
            {
              reason: "Overnight Sleep",
              label: "Sleep (Night)",
              icon: <Moon size={24} className="text-indigo-500" />,
            },
            {
              reason: "Police / Army Checkpoint",
              label: "Checkpoint",
              icon: <Shield size={24} className="text-red-500" />,
            },
            {
              reason: "Other Reason",
              label: "Other",
              icon: <AlertTriangle size={24} className="text-gray-500" />,
            },
          ].map((o) => (
            <button
              key={o.reason}
              onClick={() => confirmPause(o.reason)}
              className="p-4 bg-muted text-foreground border border-border rounded-xl font-bold text-sm flex flex-col items-center gap-2 hover:bg-muted/60 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {o.icon} {o.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
