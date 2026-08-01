import { timeAgo, tripIsStale } from "@/lib/utils";
import { AlertTriangle, CheckCircle, Copy, Shield } from "lucide-react";

const TripDetails = ({
  selectedTrip,
  setSelectedTrip,
  onSetTripStatus,
}: any) => {

  const copyCoordinates = () => {
    if (selectedTrip.current_lat == null || selectedTrip.current_lng == null)
      return;
    navigator.clipboard.writeText(
      `${selectedTrip.current_lat.toFixed(5)}, ${selectedTrip.current_lng.toFixed(5)}`,
    );
  };
  return (
    <div className="absolute top-4 right-4 w-80 bg-card/95 backdrop-blur rounded-xl shadow-2xl border border-border p-5 z-[1000] animate-in slide-in-from-right">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="font-bold text-lg text-card-foreground">
            {selectedTrip.profiles?.full_name}
          </h3>
          <p className="text-xs text-muted-foreground font-mono">
            {selectedTrip.tracking_code}
          </p>
        </div>
        <button
          onClick={() => setSelectedTrip(null)}
          className="text-muted-foreground hover:text-foreground text-xs bg-muted px-2 py-1 rounded"
        >
          Close
        </button>
      </div>

      <div className="space-y-3 text-sm">
        <div className="bg-muted/50 p-3 rounded-lg border border-border">
          <div className="flex justify-between text-xs mb-1 text-muted-foreground uppercase font-bold">
            Vehicle
          </div>
          <span className="font-mono font-bold text-foreground">
            {selectedTrip.plate_number || "Not provided"}
          </span>
        </div>

        <div className="flex justify-between py-2 border-b border-border">
          <span className="text-muted-foreground">PCM Phone</span>
          <a
            href={`tel:${selectedTrip.profiles?.phone}`}
            className="text-primary font-medium hover:underline"
          >
            {selectedTrip.profiles?.phone || "N/A"}
          </a>
        </div>
        <div className="flex justify-between py-2 border-b border-border">
          <span className="text-muted-foreground">Emergency Kin</span>
          {selectedTrip.profiles?.next_of_kin ? (
            <a
              href={`tel:${selectedTrip.profiles.next_of_kin}`}
              className="text-primary font-medium hover:underline"
            >
              {selectedTrip.profiles.next_of_kin}
            </a>
          ) : (
            <span className="font-medium text-foreground">N/A</span>
          )}
        </div>
        <div className="flex justify-between py-2 border-b border-border">
          <span className="text-muted-foreground">Planned Route</span>
          <span className="text-right font-medium text-foreground">
            {selectedTrip.origin || "?"}{" "}
            <span className="text-primary">➔</span>{" "}
            {selectedTrip.destination_state || "?"}
          </span>
        </div>
        <div className="flex justify-between py-2 border-b border-border">
          <span className="text-muted-foreground">Kin Email</span>
          {selectedTrip.profiles?.next_of_kin_email ? (
            <a
              href={`mailto:${selectedTrip.profiles.next_of_kin_email}`}
              className="text-primary font-medium hover:underline break-all text-right"
            >
              {selectedTrip.profiles.next_of_kin_email}
            </a>
          ) : (
            <span className="font-medium text-foreground">N/A</span>
          )}
        </div>

        {/* Signal Status */}
        <div className="flex justify-between py-2 border-b border-border">
          <span className="text-muted-foreground">Signal Status</span>
          <span
            className={`font-mono font-bold ${
              tripIsStale(selectedTrip) ? "text-destructive" : "text-success"
            }`}
          >
            {tripIsStale(selectedTrip) ? "⚠ STALE" : "LIVE"} (
            {timeAgo(selectedTrip.last_updated)})
          </span>
        </div>

        {/* Pause Reason */}
        {selectedTrip.status == "paused" && (
          <div className="mt-2 bg-warning/10 border border-warning/20 p-3 rounded-lg">
            <p className="text-xs font-bold text-warning uppercase mb-1">
              Stop Reason Reported
            </p>
            <p className="font-bold text-foreground flex items-center gap-2">
              {selectedTrip.pause_reason || "Unknown"}
            </p>
          </div>
        )}
      </div>

      {selectedTrip.status === "danger" && (
        <div className="mt-4 bg-destructive/10 border border-destructive/20 p-3 rounded-lg text-destructive text-xs">
          <strong className="flex items-center gap-1">
            <AlertTriangle size={12} /> SOS SIGNAL RECEIVED
          </strong>
          <p className="mt-1 space-y-2">
            <span>
              Coordinates:{" "}
              {selectedTrip.current_lat != null &&
              selectedTrip.current_lng != null
                ? `${selectedTrip.current_lat.toFixed(5)}, ${selectedTrip.current_lng.toFixed(5)}`
                : "No GPS fix yet"}
            </span>
            <span>
              Coordinate timestamp:{" "}
              {selectedTrip.last_updated
                ? new Date(selectedTrip.last_updated).toLocaleTimeString()
                : "—"}
            </span>
          </p>
        </div>
      )}

      {selectedTrip.status === "responding" && (
        <div className="mt-4 bg-amber-600/10 border border-amber-600/30 p-3 rounded-lg text-amber-600 text-xs font-medium">
          <strong className="flex items-center gap-1">
            <Shield size={12} /> INCIDENT ACKNOWLEDGED — RESPONSE IN PROGRESS
          </strong>
          <p className="mt-1">
            Updated {timeAgo(selectedTrip.last_updated)}.
          </p>
        </div>
      )}

      {/* ---- Incident workflow ---- */}
      {selectedTrip.status === "danger" && (
        <button
          onClick={() => onSetTripStatus(selectedTrip, "responding")}
          className="w-full mt-4 bg-amber-600 text-white py-2.5 rounded-lg text-xs font-bold hover:bg-amber-600/90 shadow-lg shadow-amber-600/20 flex items-center justify-center gap-2 active:scale-95 transition"
        >
          <Shield size={14} /> Acknowledge SOS — Mark as Responding
        </button>
      )}
      {selectedTrip.status === "responding" && (
        <button
          onClick={() => onSetTripStatus(selectedTrip, "resolved")}
          className="w-full mt-4 bg-primary text-primary-foreground py-2.5 rounded-lg text-xs font-bold hover:bg-primary/90 shadow-lg shadow-primary/20 flex items-center justify-center gap-2 active:scale-95 transition"
        >
          <CheckCircle size={14} /> Resolve Incident (traveler is safe)
        </button>
      )}

      {/* ---- Contact actions ---- */}
      <div className="grid grid-cols-2 gap-3 mt-3">
        {selectedTrip.profiles?.phone ? (
          <a
            href={`tel:${selectedTrip.profiles.phone}`}
            className="bg-card border border-border text-card-foreground py-2 rounded-lg text-xs font-bold hover:bg-muted text-center transition"
          >
            Traveler
          </a>
        ) : (
          <span className="bg-muted/50 border border-border text-muted-foreground py-2 rounded-lg text-xs font-bold text-center italic">
            No traveler phone
          </span>
        )}
        <a
          href="tel:112"
          className="bg-destructive text-destructive-foreground py-2 rounded-lg text-xs font-bold hover:bg-destructive/90 text-center shadow-lg shadow-destructive/20 transition"
        >
          Emergency (112)
        </a>
      </div>
      {selectedTrip.current_lat != null &&
        selectedTrip.current_lng != null && (
          <button
            onClick={copyCoordinates}
            className="w-full mt-2 text-muted-foreground hover:text-foreground text-xs font-medium flex items-center justify-center gap-1.5 py-1.5 transition"
          >
            <Copy size={12} /> Copy coordinates for dispatch
          </button>
        )}
    </div>
  );
};

export default TripDetails;
