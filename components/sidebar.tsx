import { MapPin, Search, User } from "lucide-react";

export function AdminSidebar({
  displayTrips,
  selectedTrip,
  setSelectedTrip,
  tripIsStale,
  timeAgo,
  searchTerm,
  setSearchTerm,
}: any) {
  const renderTripCard = (trip: any) => {
    const isSelected = selectedTrip?.id === trip.id;
    const isStale = tripIsStale(trip);

    // Signal Health Indicator
    let signalColor = "bg-primary";
    if (isStale) signalColor = "bg-warning"; // > 2 min lag
    if (trip.status === "danger") signalColor = "bg-destructive"; // SOS

    return (
      <div
        key={trip.id}
        onClick={() => setSelectedTrip(trip)}
        className={`p-4 rounded-xl border cursor-pointer transition-all mb-2 relative overflow-hidden ${
          isSelected
            ? "bg-primary/10 border-primary shadow-md ring-1 ring-primary/30"
            : "bg-card border-border hover:border-primary/50"
        } ${
          trip.status === "danger"
            ? "border-l-4 border-l-destructive bg-destructive/10"
            : ""
        }`}
      >
        {/* Signal Health Bar */}
        <div
          className={`absolute left-0 top-0 bottom-0 w-1 ${signalColor}`}
        ></div>

        <div className="flex justify-between items-start mb-2 pl-2">
          <span className="font-bold text-foreground">{trip.plate_number}</span>
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
              trip.status === "danger"
                ? "bg-destructive text-destructive-foreground animate-pulse"
                : trip.status === "paused"
                  ? "bg-warning/20 text-warning"
                  : "bg-primary/20 text-primary"
            }`}
          >
            {trip.status}
          </span>
        </div>

        <div className="text-xs text-muted-foreground space-y-1 pl-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 font-medium">
              <User size={12} />
              <span className="truncate max-w-[120px]">
                {trip.profiles?.full_name || trip.guest_name || "Unknown PCM"}
              </span>
            </div>
            {/* Time Ago Timer */}
            <div
              className={`font-mono ${
                isStale ? "text-destructive font-bold" : "text-muted-foreground"
              }`}
            >
              {timeAgo(trip.last_updated)}
            </div>
          </div>

          <div className="flex items-center gap-1">
            <MapPin size={12} />
            <span>
              {trip.origin}{" "}
              <span className="text-muted-foreground/50 mx-1">➔</span>{" "}
              {trip.destination_state}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full md:w-96 bg-card border-r border-border flex flex-col z-10 shadow-lg">
      {/* Search ... */}
      <div className="p-4 border-b border-border bg-muted/30">
        <div className="relative">
          <Search className="absolute left-3 top-3 text-muted-foreground w-4 h-4" />
          <input
            type="text"
            placeholder="Search Plate, Name, or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      {/* Render List */}
      <div className="flex-1 overflow-y-auto p-2">
        {displayTrips.length === 0 ? (
          <div className="text-center text-muted-foreground py-10 text-sm">
            No active trips.
          </div>
        ) : (
          displayTrips.map(renderTripCard)
        )}
      </div>
    </div>
  );
}
