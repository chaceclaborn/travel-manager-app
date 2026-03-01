'use client';

import { useMemo, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

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

interface TravelMapProps {
  trips: MapTrip[];
  homeLocation?: HomeLocation | null;
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

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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

export function TravelMap({ trips, homeLocation }: TravelMapProps) {
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
    return pts;
  }, [geoTrips, homeLocation]);

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
        transportMode: null,
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

  return (
    <MapContainer
      center={center}
      zoom={geoTrips.length === 1 ? 6 : 3}
      scrollWheelZoom
      className="h-full w-full"
      style={{ minHeight: '400px' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
      />

      {fitBoundsPoints.length > 0 && <FitBounds points={fitBoundsPoints} />}

      {geoTrips.map((trip) => {
        const color = STATUS_COLORS[trip.status] || '#64748b';
        return (
          <Marker
            key={trip.id}
            position={[trip.latitude, trip.longitude]}
            icon={createMarkerIcon(color)}
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
                      ? `${trip.departureAirportCode} \u2192 ${trip.arrivalAirportCode}`
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

      {routeLines.map((line, i) => {
        const style = line.type === 'outbound'
          ? line.transportMode === 'CAR'
            ? { color: '#10b981', weight: 2.5, opacity: 0.6 }
            : { color: '#f59e0b', weight: 2.5, opacity: 0.6 }
          : line.type === 'connecting'
            ? { color: '#3b82f6', weight: 2, opacity: 0.6 }
            : line.type === 'return'
              ? { color: '#94a3b8', weight: 1.5, opacity: 0.5, dashArray: '8 6' }
              : { color: '#f59e0b', weight: 2, opacity: 0.5, dashArray: '6 4' };
        return (
          <Polyline key={i} positions={line.positions} pathOptions={style} />
        );
      })}
    </MapContainer>
  );
}
