import { timeAgo, tripIsStale } from "@/lib/utils";
import { AlertTriangle, BellRing, Shield } from "lucide-react";

const TripDetails = ({
  selectedTrip,
  setSelectedTrip,
  vehicleDetails,
}: any) => {
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
            Driver Status
          </div>
          {vehicleDetails ? (
            <>
              <div className="flex justify-between items-center mb-1">
                <span className="font-mono font-bold text-foreground">
                  {selectedTrip.plate_number}
                </span>
                <span className="text-success text-xs flex items-center gap-1 font-bold bg-success/10 px-1 rounded border border-success/20">
                  <Shield size={10} /> VERIFIED
                </span>
              </div>
              <div className="text-xs text-muted-foreground border-t border-border pt-1 mt-1">
                <span className="block font-bold">
                  {vehicleDetails.vehicle_model} ({vehicleDetails.color})
                </span>
                <span className="block opacity-75">
                  {vehicleDetails.owner_name}
                </span>
              </div>
            </>
          ) : (
            <div className="flex justify-between items-center">
              <span className="font-mono font-bold text-foreground">
                {selectedTrip.plate_number}
              </span>
              <span className="text-muted-foreground text-xs italic">
                Registry info unavailable
              </span>
            </div>
          )}
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
          <span className="font-medium text-foreground">
            {selectedTrip.profiles?.next_of_kin || "N/A"}
          </span>
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
              Coordinates: {selectedTrip.current_lat.toFixed(5)},{" "}
              {selectedTrip.current_lng.toFixed(5)}
            </span>
            <span>
              Coordinate timestamp:{" "}
              {new Date(selectedTrip.last_updated).toLocaleTimeString()}
            </span>
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 mt-5">
        <button className="bg-card border border-border text-card-foreground py-2 rounded-lg text-xs font-bold hover:bg-muted">
          Call Driver
        </button>
        <button
          onClick={() =>
            alert(
              `Simulating Dispatch to Police HQ for coords: ${selectedTrip.current_lat}, ${selectedTrip.current_lng}`,
            )
          }
          className="bg-destructive text-destructive-foreground py-2 rounded-lg text-xs font-bold hover:bg-destructive/90 shadow-lg shadow-destructive/20 flex items-center justify-center gap-2"
        >
          <BellRing size={14} /> Dispatch Police
        </button>
      </div>
    </div>
  );
};

export default TripDetails;
