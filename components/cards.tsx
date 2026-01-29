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
            <p className="font-bold text-slate-800">
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
}: {
  trip: any;
  handleStartTrip: () => void;
  starting: boolean;
}) => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-sm w-full border border-slate-100">
        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <Car size={40} className="text-emerald-600" />
        </div>

        <h1 className="text-2xl font-bold text-slate-800 mb-2">
          Trip Registered
        </h1>
        <p className="text-slate-500 mb-6">
          You are set to travel to <strong>{trip.destination_state}</strong>.{" "}
          <br />
          Wait until the vehicle moves to start tracking.
        </p>

        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6 text-left">
          <div className="flex justify-between mb-2">
            <span className="text-xs font-bold text-slate-400 uppercase">
              Vehicle
            </span>
            <span className="font-mono font-bold text-slate-700">
              {trip.plate_number}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase">
              Tracking ID
            </span>
            <span className="font-mono font-bold text-slate-700">
              {trip.tracking_code}
            </span>
          </div>
        </div>

        <button
          onClick={handleStartTrip}
          disabled={starting}
          className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition flex items-center justify-center gap-2 active:scale-95 duration-300"
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
          <button onClick={() => setShowPauseModal(false)}>
            <X size={24} className="text-muted-foreground" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => confirmPause("Buying Food / Refreshment")}
            className="p-4 bg-blue-50 text-blue-700 rounded-xl font-bold text-sm flex flex-col items-center gap-2 hover:bg-blue-100"
          >
            <Utensils size={24} /> Food / Eat
          </button>
          <button
            onClick={() => confirmPause("Traffic / Go Slow")}
            className="p-4 bg-orange-50 text-orange-700 rounded-xl font-bold text-sm flex flex-col items-center gap-2 hover:bg-orange-100"
          >
            <Car size={24} /> Traffic
          </button>
          <button
            onClick={() => confirmPause("Vehicle Repair / Fault")}
            className="p-4 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm flex flex-col items-center gap-2 hover:bg-slate-100"
          >
            <Wrench size={24} /> Repair
          </button>
          <button
            onClick={() => confirmPause("Overnight Sleep")}
            className="p-4 bg-indigo-50 text-indigo-700 rounded-xl font-bold text-sm flex flex-col items-center gap-2 hover:bg-indigo-100"
          >
            <Moon size={24} /> Sleep (Night)
          </button>
          <button
            onClick={() => confirmPause("Police / Army Checkpoint")}
            className="p-4 bg-red-50 text-red-700 rounded-xl font-bold text-sm flex flex-col items-center gap-2 hover:bg-red-100"
          >
            <Shield size={24} /> Checkpoint
          </button>
          <button
            onClick={() => confirmPause("Other Reason")}
            className="p-4 bg-gray-50 text-gray-700 rounded-xl font-bold text-sm flex flex-col items-center gap-2 hover:bg-gray-100"
          >
            <AlertTriangle size={24} /> Other
          </button>
        </div>
      </div>
    </div>
  );
};
