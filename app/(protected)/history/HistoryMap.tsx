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

// --- Fix Leaflet Icons ---
import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";

const DefaultIcon = L.icon({
  // @ts-ignore
  iconUrl: icon,
  // @ts-ignore
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

// Helper to fit map bounds to the route
function MapBounds({ coords }: { coords: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (coords.length > 0) {
      const bounds = L.latLngBounds(coords);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [coords, map]);
  return null;
}

export default function HistoryMap({
  routePath,
}: {
  routePath: [number, number][];
}) {
  const { resolvedTheme } = useTheme();

  return (
    <MapContainer center={[9.082, 8.6753]} zoom={6} className="h-full w-full">
      <TileLayer
        url={
          resolvedTheme === "dark"
            ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        }
      />

      {/* Draw the Path */}
      {routePath.length > 1 && (
        <Polyline
          positions={routePath}
          color="#059669"
          weight={4}
          opacity={0.8}
        />
      )}

      {/* Start/End Markers */}
      {routePath.length > 0 && (
        <Marker position={routePath[0]}>
          <Popup>Start Point</Popup>
        </Marker>
      )}
      {routePath.length > 0 && (
        <Marker position={routePath[routePath.length - 1]}>
          <Popup>Arrival Point</Popup>
        </Marker>
      )}

      <MapBounds coords={routePath} />
    </MapContainer>
  );
}
