"use client";

import { useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import { useTheme } from "next-themes";
// @ts-ignore
import "leaflet/dist/leaflet.css";

// --- Fix Leaflet Icons (Standard Boilerplate) ---
import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";
import { destinationIcon } from "@/components/map-icons";

let DefaultIcon = L.icon({
  // @ts-ignore
  iconUrl: icon,
  // @ts-ignore
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;
// --------------------------------------------

// Map Auto-Center Component (live tracking follows the traveler)
function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 13);
  }, [center, map]);
  return null;
}

// Before the journey starts there is no live fix — show the whole planned
// route (departure -> destination) instead of a single zoomed point.
function FitRoute({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length >= 2) {
      map.fitBounds(L.latLngBounds(points), { padding: [40, 40] });
    }
  }, [map]); // eslint-disable-line react-hooks/exhaustive-deps -- once per mount
  return null;
}

export default function TrackingMap({
  lat,
  lng,
  destination = null,
  origin = null,
  live = false,
}: {
  lat: number;
  lng: number;
  destination?: [number, number] | null;
  origin?: [number, number] | null;
  live?: boolean;
}) {
  const { resolvedTheme } = useTheme();
  const routePoints: [number, number][] = [origin, destination].filter(
    (p): p is [number, number] => !!p,
  );

  return (
    <MapContainer
      center={[lat, lng]}
      zoom={13}
      className="h-full w-full rounded-xl"
    >
      <TileLayer
        url={
          resolvedTheme === "dark"
            ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        }
      />
      {/* Planned route: departure -> destination */}
      {origin && destination && (
        <Polyline
          positions={[origin, destination]}
          color="#3b82f6"
          weight={3}
          dashArray="8 6"
          opacity={0.75}
        />
      )}
      {destination && (
        <Marker position={destination} icon={destinationIcon}>
          <Popup>
            <strong>Destination</strong>
            <br />
            Planned route end
          </Popup>
        </Marker>
      )}
      <Marker position={[lat, lng]}>
        <Popup>{live ? "Current Location" : "Departure Point"}</Popup>
      </Marker>
      {live ? (
        <MapUpdater center={[lat, lng]} />
      ) : (
        <FitRoute points={routePoints} />
      )}
    </MapContainer>
  );
}
