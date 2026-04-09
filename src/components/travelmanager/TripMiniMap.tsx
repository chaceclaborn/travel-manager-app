'use client';

import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
// leaflet/dist/leaflet.css is imported globally in src/app/globals.css
import { MapPinOff } from 'lucide-react';

interface TripMiniMapProps {
  latitude: number | null;
  longitude: number | null;
  destination?: string | null;
}

/**
 * Small marker icon (matches the TravelMap style but sized down).
 */
function createMarkerIcon() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="22" height="32">
    <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z" fill="#f59e0b" stroke="#fff" stroke-width="1.5"/>
    <circle cx="12" cy="12" r="5" fill="#fff"/>
  </svg>`;
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [22, 32],
    iconAnchor: [11, 32],
  });
}

/**
 * A small, non-interactive-ish map showing a single marker at the trip's location.
 * Must be dynamically imported (ssr: false) by the parent to avoid SSR errors
 * from Leaflet touching `window`.
 */
export function TripMiniMap({
  latitude,
  longitude,
  destination,
}: TripMiniMapProps) {
  if (latitude == null || longitude == null) {
    return (
      <div className="h-full rounded-xl border border-slate-200 bg-slate-50 p-6 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-600">
            Location
          </h3>
        </div>
        <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
          <MapPinOff className="size-8 text-slate-300" />
          <p className="text-sm text-slate-500">No location set</p>
          <p className="text-xs text-slate-400">
            Add coordinates to see this trip on the map
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow duration-300 hover:shadow-md">
      <div className="flex items-center justify-between px-6 pt-5 pb-3">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-600">
          Location
        </h3>
        {destination && (
          <span className="truncate text-xs text-slate-500" title={destination}>
            {destination}
          </span>
        )}
      </div>
      {/* z-0 isolate contains Leaflet's internal z-index stack so it doesn't
          fight with the app nav — same lesson as the main map page. */}
      <div className="relative z-0 h-[200px] w-full isolate">
        <MapContainer
          center={[latitude, longitude]}
          zoom={6}
          scrollWheelZoom={false}
          zoomControl={false}
          dragging={true}
          doubleClickZoom={false}
          attributionControl={false}
          className="h-full w-full"
        >
          <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
          <Marker
            position={[latitude, longitude]}
            icon={createMarkerIcon()}
            keyboard={false}
          />
        </MapContainer>
      </div>
    </div>
  );
}
