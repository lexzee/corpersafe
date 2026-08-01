import L from "leaflet";

/**
 * Blue map-pin used to mark the planned destination on every map
 * (traveler, parent tracker, Mission Control).
 */
export const destinationIcon = new L.DivIcon({
  className: "corpersafe-destination-icon",
  html: `<div style="position:relative;width:28px;height:28px;">
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 1px 2px rgba(0,0,0,0.45));">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0Z" fill="#2563eb" stroke="#ffffff" stroke-width="1.5"/>
      <circle cx="12" cy="10" r="2.8" fill="#ffffff"/>
    </svg>
  </div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 26],
});
