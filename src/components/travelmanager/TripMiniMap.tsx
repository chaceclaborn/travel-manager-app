'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
// leaflet/dist/leaflet.css is imported globally in src/app/globals.css
import { MapPinOff } from 'lucide-react';

interface MiniMapStop {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

interface TripMiniMapProps {
  latitude: number | null;
  longitude: number | null;
  destination?: string | null;
  stops?: MiniMapStop[];
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
 * Numbered dot for stops within the trip — visually subordinate to the main
 * destination pin.
 */
function createStopIcon(n: number) {
  const html = `<div style="display:flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:9999px;background:#f59e0b;border:2px solid #fff;box-shadow:0 1px 3px rgba(15,23,42,.3);color:#fff;font-size:10px;font-weight:700;font-family:inherit;">${n}</div>`;
  return L.divIcon({
    html,
    className: '',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

/**
 * Re-fits the viewport whenever the set of points changes. Needed because
 * stops load async after the map mounts — MapContainer's initial
 * center/bounds are mount-time only.
 */
function FitPoints({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 6);
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [24, 24], maxZoom: 9 });
  }, [map, points]);
  return null;
}

/**
 * A small, non-interactive-ish map showing the trip's destination plus any
 * stops visited within the trip, connected in order.
 * Must be dynamically imported (ssr: false) by the parent to avoid SSR errors
 * from Leaflet touching `window`.
 */
export function TripMiniMap({
  latitude,
  longitude,
  destination,
  stops = [],
}: TripMiniMapProps) {
  const hasMain = latitude != null && longitude != null;
  const stopPoints: [number, number][] = stops.map((s) => [s.latitude, s.longitude]);
  const allPoints: [number, number][] = hasMain
    ? [[latitude, longitude], ...stopPoints]
    : stopPoints;

  if (allPoints.length === 0) {
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
          center={allPoints[0]}
          zoom={6}
          scrollWheelZoom={false}
          zoomControl={false}
          dragging={true}
          doubleClickZoom={false}
          attributionControl={false}
          className="h-full w-full"
        >
          <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
          <FitPoints points={allPoints} />
          {hasMain && (
            <Marker
              position={[latitude, longitude]}
              icon={createMarkerIcon()}
              keyboard={false}
            />
          )}
          {stops.map((stop, i) => (
            <Marker
              key={stop.id}
              position={[stop.latitude, stop.longitude]}
              icon={createStopIcon(i + 1)}
              keyboard={false}
              title={stop.name}
            />
          ))}
          {allPoints.length > 1 && (
            <Polyline
              positions={allPoints}
              pathOptions={{ color: '#f59e0b', weight: 2.5, opacity: 0.7, dashArray: '6 6' }}
            />
          )}
        </MapContainer>
      </div>
    </div>
  );
}
