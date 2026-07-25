'use client';

import { useMemo, useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
// leaflet/dist/leaflet.css is imported globally in src/app/globals.css
import { formatDate } from '@/lib/date-utils';

interface MapTrip {
  id: string;
  title: string;
  destination: string | null;
  startDate: string | null;
  endDate: string | null;
  status: string;
  latitude: number | null;
  longitude: number | null;
  transportMode: string | null;
  departureAirportCode: string | null;
  departureAirportLat: number | null;
  departureAirportLng: number | null;
  arrivalAirportCode: string | null;
  arrivalAirportLat: number | null;
  arrivalAirportLng: number | null;
}

interface HomeLocation {
  latitude: number;
  longitude: number;
  city: string | null;
}

interface MapStop {
  id: string;
  tripId: string;
  name: string;
  latitude: number;
  longitude: number;
  travelMode: string | null;
  sortOrder: number;
}

interface TravelMapProps {
  trips: MapTrip[];
  homeLocation?: HomeLocation | null;
  stops?: MapStop[];
}

const STATUS_COLORS: Record<string, string> = {
  PLANNED: '#f59e0b',
  COMPLETED: '#22c55e',
  IN_PROGRESS: '#3b82f6',
  DRAFT: '#64748b',
  CANCELLED: '#ef4444',
};

const STATUS_LABELS: Record<string, string> = {
  PLANNED: 'Planned',
  COMPLETED: 'Completed',
  IN_PROGRESS: 'In Progress',
  DRAFT: 'Draft',
  CANCELLED: 'Cancelled',
};

function createMarkerIcon(color: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="24" height="36">
    <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z" fill="${color}" stroke="#fff" stroke-width="1.5"/>
    <circle cx="12" cy="12" r="5" fill="#fff"/>
  </svg>`;

  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [24, 36],
    iconAnchor: [12, 36],
    popupAnchor: [0, -36],
  });
}

function createHomeIcon() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="28" height="40">
    <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z" fill="#7c3aed" stroke="#fff" stroke-width="1.5"/>
    <path d="M12 7l-5 4v6h3v-4h4v4h3v-6l-5-4z" fill="#fff"/>
  </svg>`;
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [28, 40],
    iconAnchor: [14, 40],
    popupAnchor: [0, -40],
  });
}

/** Small numbered dot for a stop within a trip's route. */
function createStopDotIcon(n: number, color: string) {
  const html = `<div style="display:flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:9999px;background:${color};border:2px solid #fff;box-shadow:0 1px 3px rgba(15,23,42,.3);color:#fff;font-size:9px;font-weight:700;font-family:inherit;">${n}</div>`;
  return L.divIcon({
    html,
    className: '',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -9],
  });
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 4);
      return;
    }
    const bounds = L.latLngBounds(points.map(([lat, lng]) => L.latLng(lat, lng)));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 5 });
  }, [map, points]);
  return null;
}

export function TravelMap({ trips, homeLocation, stops = [] }: TravelMapProps) {
  // Group stops into per-trip route chains, ordered by route position.
  const stopChains = useMemo(() => {
    const byTrip = new Map<string, MapStop[]>();
    for (const s of stops) {
      const list = byTrip.get(s.tripId) ?? [];
      list.push(s);
      byTrip.set(s.tripId, list);
    }
    for (const list of byTrip.values()) {
      list.sort((a, b) => a.sortOrder - b.sortOrder);
    }
    return byTrip;
  }, [stops]);

  const geoTrips = useMemo(
    () => trips.filter((t): t is MapTrip & { latitude: number; longitude: number } =>
      t.latitude !== null && t.longitude !== null
    ),
    [trips]
  );

  const center = useMemo<[number, number]>(() => {
    const points: { lat: number; lng: number }[] = geoTrips.map(t => ({ lat: t.latitude, lng: t.longitude }));
    if (homeLocation) points.push({ lat: homeLocation.latitude, lng: homeLocation.longitude });
    if (points.length === 0) return [20, 0];
    const avgLat = points.reduce((sum, p) => sum + p.lat, 0) / points.length;
    const avgLng = points.reduce((sum, p) => sum + p.lng, 0) / points.length;
    return [avgLat, avgLng];
  }, [geoTrips, homeLocation]);

  const fitBoundsPoints = useMemo<[number, number][]>(() => {
    const pts: [number, number][] = geoTrips.map(t => [t.latitude, t.longitude]);
    if (homeLocation) pts.push([homeLocation.latitude, homeLocation.longitude]);
    for (const s of stops) pts.push([s.latitude, s.longitude]);
    return pts;
  }, [geoTrips, homeLocation, stops]);

  const routeLines = useMemo(() => {
    const sorted = [...geoTrips].sort((a, b) => {
      if (!a.startDate || !b.startDate) return 0;
      return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
    });

    if (sorted.length === 0) return [];

    if (!homeLocation) {
      return sorted.slice(0, -1).map((trip, i) => ({
        positions: [
          [trip.latitude, trip.longitude] as [number, number],
          [sorted[i + 1].latitude, sorted[i + 1].longitude] as [number, number],
        ],
        type: 'fallback' as const,
        transportMode: trip.transportMode,
      }));
    }

    const home: [number, number] = [homeLocation.latitude, homeLocation.longitude];
    const lines: { positions: [number, number][]; type: 'outbound' | 'connecting' | 'return'; transportMode: string | null }[] = [];

    for (let i = 0; i < sorted.length; i++) {
      const dest: [number, number] = [sorted[i].latitude, sorted[i].longitude];

      if (i === 0) {
        const trip = sorted[0];
        if (trip.transportMode === 'FLIGHT' && trip.departureAirportLat != null && trip.departureAirportLng != null && trip.arrivalAirportLat != null && trip.arrivalAirportLng != null) {
          lines.push({ positions: [home, [trip.departureAirportLat, trip.departureAirportLng]], type: 'outbound', transportMode: 'FLIGHT' });
          lines.push({ positions: [[trip.departureAirportLat, trip.departureAirportLng], [trip.arrivalAirportLat, trip.arrivalAirportLng]], type: 'outbound', transportMode: 'FLIGHT' });
          lines.push({ positions: [[trip.arrivalAirportLat, trip.arrivalAirportLng], dest], type: 'outbound', transportMode: 'FLIGHT' });
        } else {
          lines.push({ positions: [home, dest], type: 'outbound', transportMode: trip.transportMode });
        }
      } else {
        const prev = sorted[i - 1];
        const prevDest: [number, number] = [prev.latitude, prev.longitude];
        const prevEnd = prev.endDate;
        const currStart = sorted[i].startDate;
        const overlaps = prevEnd != null && currStart != null
          && new Date(prevEnd) >= new Date(currStart);

        if (overlaps) {
          lines.push({ positions: [prevDest, dest], type: 'connecting', transportMode: null });
        } else {
          lines.push({ positions: [prevDest, home], type: 'return', transportMode: null });
          const trip = sorted[i];
          if (trip.transportMode === 'FLIGHT' && trip.departureAirportLat != null && trip.departureAirportLng != null && trip.arrivalAirportLat != null && trip.arrivalAirportLng != null) {
            lines.push({ positions: [home, [trip.departureAirportLat, trip.departureAirportLng]], type: 'outbound', transportMode: 'FLIGHT' });
            lines.push({ positions: [[trip.departureAirportLat, trip.departureAirportLng], [trip.arrivalAirportLat, trip.arrivalAirportLng]], type: 'outbound', transportMode: 'FLIGHT' });
            lines.push({ positions: [[trip.arrivalAirportLat, trip.arrivalAirportLng], dest], type: 'outbound', transportMode: 'FLIGHT' });
          } else {
            lines.push({ positions: [home, dest], type: 'outbound', transportMode: trip.transportMode });
          }
        }
      }
    }

    const last = sorted[sorted.length - 1];
    lines.push({
      positions: [[last.latitude, last.longitude], home],
      type: 'return',
      transportMode: null,
    });

    return lines;
  }, [geoTrips, homeLocation]);

  const [roadGeometries, setRoadGeometries] = useState<Record<string, [number, number][]>>({});

  useEffect(() => {
    const carRoutes = routeLines
      .map((line, i) => ({ line, i }))
      .filter(({ line }) =>
        line.transportMode === 'CAR' && (line.type === 'outbound' || line.type === 'fallback')
      );

    let cancelled = false;

    const fetchAll = async () => {
      // No car routes — clear any stale geometries asynchronously so the
      // setState happens off the synchronous effect body (React 19 lint).
      if (carRoutes.length === 0) {
        if (!cancelled) setRoadGeometries({});
        return;
      }

      const results = await Promise.allSettled(
        carRoutes.map(async ({ line, i }) => {
          const [fromLat, fromLng] = line.positions[0];
          const [toLat, toLng] = line.positions[line.positions.length - 1];
          const res = await fetch(
            `/api/distance/road?fromLat=${fromLat}&fromLng=${fromLng}&toLat=${toLat}&toLng=${toLng}`
          );
          if (!res.ok) return { index: i, geometry: null };
          const data = await res.json();
          return { index: i, geometry: data.geometry as [number, number][] | null };
        })
      );

      if (cancelled) return;

      const geomMap: Record<string, [number, number][]> = {};
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value.geometry) {
          geomMap[`${result.value.index}`] = result.value.geometry;
        }
      }
      setRoadGeometries(geomMap);
    };

    fetchAll();

    return () => { cancelled = true; };
  }, [routeLines]);

  return (
    <MapContainer
      center={center}
      zoom={geoTrips.length === 1 ? 6 : 3}
      scrollWheelZoom
      className="h-full w-full"
      style={{ minHeight: '400px' }}
    >
      {/* `light_all` rather than `voyager`: the redesign wants the basemap to
          recede so the pins and routes carry the color. Voyager's own road and
          landuse tints competed with the status palette. */}
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        subdomains="abcd"
        maxZoom={19}
      />

      {fitBoundsPoints.length > 0 && <FitBounds points={fitBoundsPoints} />}

      {geoTrips.map((trip) => {
        const color = STATUS_COLORS[trip.status] || '#64748b';
        return (
          <Marker
            key={trip.id}
            position={[trip.latitude, trip.longitude]}
            icon={createMarkerIcon(color)}
            keyboard={false}
          >
            <Popup>
              <div className="min-w-[180px]">
                <div className="font-semibold text-sm text-slate-900">{trip.title}</div>
                {trip.destination && (
                  <div className="text-xs text-slate-500 mt-0.5">{trip.destination}</div>
                )}
                <div className="flex items-center gap-1.5 mt-1.5">
                  <span
                    className="inline-block size-2 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-xs text-slate-600">{STATUS_LABELS[trip.status] || trip.status}</span>
                </div>
                {trip.transportMode && (
                  <div className="text-xs text-slate-500 mt-1">
                    {trip.transportMode === 'FLIGHT' ? '\u2708\uFE0F' : '\uD83D\uDE97'}{' '}
                    {trip.transportMode === 'FLIGHT' && trip.departureAirportCode && trip.arrivalAirportCode
                      ? `${trip.departureAirportCode} → ${trip.arrivalAirportCode}`
                      : trip.transportMode === 'FLIGHT' ? 'Flight' : 'Driving'}
                  </div>
                )}
                {(trip.startDate || trip.endDate) && (
                  <div className="text-xs text-slate-400 mt-1">
                    {formatDate(trip.startDate)}
                    {trip.endDate && ` — ${formatDate(trip.endDate)}`}
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        );
      })}

      {homeLocation && (
        <Marker
          position={[homeLocation.latitude, homeLocation.longitude]}
          icon={createHomeIcon()}
          keyboard={false}
        >
          <Popup>
            <div className="min-w-[120px]">
              <div className="font-semibold text-sm text-slate-900">Home</div>
              {homeLocation.city && (
                <div className="text-xs text-slate-500 mt-0.5">{homeLocation.city}</div>
              )}
            </div>
          </Popup>
        </Marker>
      )}

      {/* Per-trip route chains: every place visited within each trip.
          Dots inherit the trip's status color; legs are dashed for flights
          and solid for ground travel. */}
      {[...stopChains.entries()].map(([tripId, chain]) => {
        const trip = trips.find((t) => t.id === tripId);
        const color = STATUS_COLORS[trip?.status ?? ''] || '#f59e0b';
        return chain.map((stop, i) => (
          <Marker
            key={stop.id}
            position={[stop.latitude, stop.longitude]}
            icon={createStopDotIcon(i + 1, color)}
            keyboard={false}
          >
            <Popup>
              <div className="min-w-[140px]">
                <div className="font-semibold text-sm text-slate-900">{stop.name}</div>
                {trip && (
                  <div className="text-xs text-slate-500 mt-0.5">
                    Stop {i + 1} · {trip.title}
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        ));
      })}
      {[...stopChains.entries()].map(([tripId, chain]) =>
        chain.slice(1).map((stop, i) => {
          const from = chain[i];
          const isFlight = (stop.travelMode ?? 'drive') === 'flight';
          return (
            <Polyline
              key={`chain-${tripId}-${stop.id}`}
              positions={[
                [from.latitude, from.longitude],
                [stop.latitude, stop.longitude],
              ]}
              pathOptions={{
                color: STATUS_COLORS[trips.find((t) => t.id === tripId)?.status ?? ''] || '#f59e0b',
                weight: 2,
                opacity: 0.65,
                dashArray: isFlight ? '6 6' : undefined,
              }}
            />
          );
        })
      )}

      {routeLines.map((line, i) => {
        const isCar = line.transportMode === 'CAR';
        const style = line.type === 'outbound' || line.type === 'fallback'
          ? isCar
            ? { color: '#10b981', weight: 3, opacity: 0.7, dashArray: '10 5' }
            : { color: '#f59e0b', weight: 2.5, opacity: 0.6 }
          : line.type === 'connecting'
            ? { color: '#3b82f6', weight: 2, opacity: 0.6 }
            : line.type === 'return'
              ? { color: '#94a3b8', weight: 1.5, opacity: 0.5, dashArray: '8 6' }
              : { color: '#f59e0b', weight: 2, opacity: 0.5, dashArray: '6 4' };
        const positions = (isCar && roadGeometries[`${i}`])
          ? roadGeometries[`${i}`]
          : line.positions;
        return (
          <Polyline key={i} positions={positions} pathOptions={style} />
        );
      })}
    </MapContainer>
  );
}
