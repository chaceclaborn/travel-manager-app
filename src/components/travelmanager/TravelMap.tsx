'use client';

import { useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
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
}

interface TravelMapProps {
  trips: MapTrip[];
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

export function TravelMap({ trips }: TravelMapProps) {
  const geoTrips = useMemo(
    () => trips.filter((t): t is MapTrip & { latitude: number; longitude: number } =>
      t.latitude !== null && t.longitude !== null
    ),
    [trips]
  );

  const center = useMemo<[number, number]>(() => {
    if (geoTrips.length === 0) return [20, 0];
    const avgLat = geoTrips.reduce((sum, t) => sum + t.latitude, 0) / geoTrips.length;
    const avgLng = geoTrips.reduce((sum, t) => sum + t.longitude, 0) / geoTrips.length;
    return [avgLat, avgLng];
  }, [geoTrips]);

  const routeLines = useMemo(() => {
    const sorted = [...geoTrips].sort((a, b) => {
      if (!a.startDate || !b.startDate) return 0;
      return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
    });
    const lines: [number, number][][] = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      lines.push([
        [sorted[i].latitude, sorted[i].longitude],
        [sorted[i + 1].latitude, sorted[i + 1].longitude],
      ]);
    }
    return lines;
  }, [geoTrips]);

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

      {routeLines.map((line, i) => (
        <Polyline
          key={i}
          positions={line}
          pathOptions={{ color: '#f59e0b', weight: 2, opacity: 0.5, dashArray: '6 4' }}
        />
      ))}
    </MapContainer>
  );
}
