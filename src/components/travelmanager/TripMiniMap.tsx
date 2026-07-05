'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
// leaflet/dist/leaflet.css is imported globally in src/app/globals.css
import { MapPinOff } from 'lucide-react';
import { HOME_STOP_ID, HOME_START_STOP_ID, type TripStopData, type RouteLeg } from './TripStops';

const isHomeId = (id: string) => id === HOME_STOP_ID || id === HOME_START_STOP_ID;

interface TripMiniMapProps {
  latitude: number | null;
  longitude: number | null;
  destination?: string | null;
  stops?: TripStopData[];
  legs?: RouteLeg[];
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
 * Home marker for the implicit return-home point (violet, matches the
 * home marker style on the main travel map).
 */
function createHomeIcon() {
  const html = `<div style="display:flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:9999px;background:#7c3aed;border:2px solid #fff;box-shadow:0 1px 3px rgba(15,23,42,.35);">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
  </div>`;
  return L.divIcon({
    html,
    className: '',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

/**
 * Numbered dot for route stops.
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
 * Trip map: the ordered route through every place visited. Driven legs
 * follow the actual roads (geometry from the routing proxy); flights and
 * other non-road legs draw as dashed straight lines. The trip's top-level
 * destination pin is shown standalone only until it's added to the route.
 * Must be dynamically imported (ssr: false) by the parent — Leaflet
 * touches `window`.
 */
export function TripMiniMap({
  latitude,
  longitude,
  destination,
  stops = [],
  legs = [],
}: TripMiniMapProps) {
  const hasMain = latitude != null && longitude != null;
  const stopPoints: [number, number][] = stops.map((s) => [s.latitude, s.longitude]);

  // Show the destination pin only if it isn't already represented as a stop
  // (compare by proximity — ~1km — so "El Paso" the stop hides the dupe pin).
  const mainIsAStop =
    hasMain &&
    stops.some(
      (s) => Math.abs(s.latitude - latitude) < 0.01 && Math.abs(s.longitude - longitude) < 0.01
    );
  const showMainPin = hasMain && !mainIsAStop;

  const allPoints: [number, number][] = showMainPin
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
          {stops.length > 1 ? 'Route' : 'Location'}
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
          {showMainPin && (
            <Marker
              position={[latitude, longitude]}
              icon={createMarkerIcon()}
              keyboard={false}
            />
          )}
          {(() => {
            let n = 0;
            return stops.map((stop) => (
              <Marker
                key={stop.id}
                position={[stop.latitude, stop.longitude]}
                icon={isHomeId(stop.id) ? createHomeIcon() : createStopIcon(++n)}
                keyboard={false}
                title={stop.name}
              />
            ));
          })()}
          {/* Route legs between consecutive stops */}
          {stops.map((stop, i) => {
            if (i === 0) return null;
            const from = stops[i - 1];
            const leg = legs.find((l) => l.toId === stop.id);
            const positions: [number, number][] =
              leg?.geometry && leg.geometry.length > 1
                ? leg.geometry
                : [
                    [from.latitude, from.longitude],
                    [stop.latitude, stop.longitude],
                  ];
            const isRoad = !!leg?.geometry;
            return (
              <Polyline
                key={`leg-${stop.id}`}
                positions={positions}
                pathOptions={{
                  color: '#f59e0b',
                  weight: isRoad ? 3 : 2.5,
                  opacity: isRoad ? 0.85 : 0.6,
                  dashArray: isRoad ? undefined : '6 6',
                }}
              />
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
}
