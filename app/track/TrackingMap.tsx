"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { useTheme } from "next-themes";
// @ts-ignore
import "leaflet/dist/leaflet.css";

// --- Fix Leaflet Icons (Standard Boilerplate) ---
import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";

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

// Map Auto-Center Component
function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 13);
  }, [center, map]);
  return null;
}

export default function TrackingMap({
  lat,
  lng,
}: {
  lat: number;
  lng: number;
}) {
  const { resolvedTheme } = useTheme();

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
      <Marker position={[lat, lng]}>
        <Popup>Current Location</Popup>
      </Marker>
      <MapUpdater center={[lat, lng]} />
    </MapContainer>
  );
}
