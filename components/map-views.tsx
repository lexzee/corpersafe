"use client";

// @ts-ignore
import "leaflet/dist/leaflet.css";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";
import L from "leaflet";
import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import TripDetails from "./trip-details";
import { useTheme } from "next-themes";

const DefaultIcon = L.icon({
  // @ts-ignore
  iconUrl: icon,
  // @ts-ignore
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const createIcon = (color: string) =>
  new L.DivIcon({
    className: "custom-icon",
    html: `<div style="
    background-color: ${color};
    width: 14px; height: 14px;
    border-radius: 50%;
    border: 2px solid white;
    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
  "></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });

const Icons = {
  active: createIcon("#10b981"), // Green
  paused: createIcon("#f59e0b"), // Amber
  danger: new L.DivIcon({
    // Pulsing Red for SOS - Animation applied to inner div to avoid Leaflet transform conflict
    className: "bg-transparent border-none",
    html: `<div class="relative flex items-center justify-center w-full h-full"><span class="absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75 animate-ping"></span><span class="relative inline-flex rounded-full h-3 w-3 bg-destructive"></span></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  }),
};

// For Admin Map View
function MapController({ selectedTrip }: { selectedTrip: any }) {
  const map = useMap();
  useEffect(() => {
    if (selectedTrip?.current_lat) {
      map.setView([selectedTrip.current_lat, selectedTrip.current_lng], 14, {
        animate: true,
      });
    }
  }, [selectedTrip, map]);
  return null;
}

// For User Map View
function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, 13);
  }, [center, map]);
  return null;
}
export function AdminMapView({
  displayTrips,
  selectedTrip,
  setSelectedTrip,
  vehicleDetails,
}: any) {
  const { resolvedTheme } = useTheme();

  return (
    <div className="flex-1 relative bg-muted hidden md:block">
      <MapContainer center={[9.082, 8.6753]} zoom={9} className="h-full w-full">
        <TileLayer
          key={resolvedTheme}
          attribution="&copy; OpenStreetMap"
          url={
            resolvedTheme === "dark"
              ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          }
        />
        {displayTrips.map(
          (trip: any) =>
            trip.current_lat && (
              <Marker
                key={trip.id}
                position={[trip.current_lat, trip.current_lng]}
                icon={
                  trip.status === "danger"
                    ? Icons.danger
                    : trip.status === "paused"
                      ? Icons.paused
                      : Icons.active
                }
                eventHandlers={{ click: () => setSelectedTrip(trip) }}
              />
            ),
        )}
        <MapController selectedTrip={selectedTrip} />
      </MapContainer>

      {/* Trip Details Card (Floating Overlay) */}
      {selectedTrip && (
        <TripDetails
          selectedTrip={selectedTrip}
          setSelectedTrip={setSelectedTrip}
          vehicleDetails={vehicleDetails}
        />
      )}
    </div>
  );
}
export function UserMapView({ currentLoc, speed, trip }: any) {
  const { resolvedTheme } = useTheme();

  return (
    <div className="h-full w-full relative">
      <MapContainer
        center={currentLoc}
        zoom={13}
        scrollWheelZoom={false}
        className="h-full w-full"
      >
        <TileLayer
          key={resolvedTheme}
          url={
            resolvedTheme === "dark"
              ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          }
          attribution="&copy; OpenStreetMap"
        />
        <Marker position={currentLoc} icon={DefaultIcon}>
          <Popup>You are here, Speed: {speed} km/h</Popup>
        </Marker>
        <MapUpdater center={currentLoc} />
      </MapContainer>
      {trip.status === "paused" && (
        <div className="absolute top-2 left-2 right-2 bg-amber-100/95 backdrop-blur p-2 rounded-lg z-400 border border-amber-200 flex items-center gap-2 text-amber-800 text-xs font-bold shadow-sm animate-in slide-in-from-top">
          <AlertTriangle size={16} />
          <span>Vehicle Stopped. System Paused.</span>
        </div>
      )}
    </div>
  );
}
