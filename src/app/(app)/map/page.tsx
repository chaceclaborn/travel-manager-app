'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { MapPin, Globe as GlobeIcon, Plane, Loader2 } from 'lucide-react';
import { TMBreadcrumb } from '@/components/travelmanager/TMBreadcrumb';

const TravelGlobe = dynamic(
  () => import('@/components/travelmanager/TravelGlobe').then(m => ({ default: m.TravelGlobe })),
  { ssr: false }
);

interface GlobeTrip {
  id: string;
  title: string;
  destination: string | null;
  startDate: string | null;
  endDate: string | null;
  status: string;
  latitude: number | null;
  longitude: number | null;
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function MapPage() {
  const [trips, setTrips] = useState<GlobeTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [geocoding, setGeocoding] = useState(false);

  const geocodeMissing = useCallback(async (tripsToGeocode: GlobeTrip[]) => {
    const missing = tripsToGeocode.filter(
      t => t.destination && t.latitude === null && t.longitude === null
    );
    if (missing.length === 0) return tripsToGeocode;

    setGeocoding(true);
    const updated = [...tripsToGeocode];

    for (const trip of missing) {
      try {
        const res = await fetch(`/api/trips/${trip.id}/geocode`, { method: 'POST' });
        if (res.ok) {
          const data = await res.json();
          const idx = updated.findIndex(t => t.id === trip.id);
          if (idx !== -1) {
            updated[idx] = { ...updated[idx], latitude: data.latitude, longitude: data.longitude };
          }
        }
      } catch {
        // Skip failed geocodes silently
      }
    }

    setGeocoding(false);
    return updated;
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/trips');
        if (!res.ok) throw new Error('Failed to fetch trips');
        const data = await res.json();

        const safeData = Array.isArray(data) ? data : [];
        const mapped: GlobeTrip[] = safeData.map((t: Record<string, unknown>) => ({
          id: t.id as string,
          title: t.title as string,
          destination: (t.destination as string) || null,
          startDate: (t.startDate as string) || null,
          endDate: (t.endDate as string) || null,
          status: t.status as string,
          latitude: (t.latitude as number) ?? null,
          longitude: (t.longitude as number) ?? null,
        }));

        const geocoded = await geocodeMissing(mapped);
        setTrips(geocoded);
      } catch (error) {
        console.error('Failed to load trips:', error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [geocodeMissing]);

  const geoTrips = trips.filter(t => t.latitude !== null && t.longitude !== null);

  const uniqueDestinations = new Set(
    geoTrips.map(t => t.destination).filter(Boolean)
  ).size;

  const totalDistance = (() => {
    const sorted = [...geoTrips].sort((a, b) => {
      if (!a.startDate || !b.startDate) return 0;
      return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
    });
    let dist = 0;
    for (let i = 0; i < sorted.length - 1; i++) {
      dist += haversineDistance(
        sorted[i].latitude!, sorted[i].longitude!,
        sorted[i + 1].latitude!, sorted[i + 1].longitude!
      );
    }
    return dist;
  })();

  const completedTrips = geoTrips.filter(t => t.status === 'COMPLETED').length;

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-6 pb-2">
        <TMBreadcrumb items={[
          { label: 'Travel Manager', href: '/' },
          { label: 'Map' },
        ]} />
        <h1 className="text-2xl font-bold text-slate-900">Travel Map</h1>
        <p className="text-sm text-slate-500 mt-1">Your destinations around the world</p>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-4 p-4 min-h-0">
        {/* Globe */}
        <div className="flex-1 rounded-xl overflow-hidden border border-slate-200 relative min-h-[400px]">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-950">
              <div className="text-center">
                <Loader2 className="size-6 text-white/60 animate-spin mx-auto mb-2" />
                <p className="text-white/50 text-sm">Loading trips...</p>
              </div>
            </div>
          ) : (
            <>
              <TravelGlobe trips={trips} />
              {geocoding && (
                <div className="absolute top-3 left-3 bg-slate-900/90 text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-2">
                  <Loader2 className="size-3 animate-spin" />
                  Geocoding destinations...
                </div>
              )}
              {geoTrips.length === 0 && !geocoding && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center text-white/60">
                    <GlobeIcon className="size-10 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No geocoded trips yet</p>
                    <p className="text-xs mt-1 opacity-60">Add destinations to your trips to see them on the globe</p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Sidebar Stats */}
        <div className="lg:w-72 flex flex-row lg:flex-col gap-3">
          <div className="flex-1 bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-center gap-2 text-slate-500 mb-1">
              <MapPin className="size-4" />
              <span className="text-xs font-medium uppercase tracking-wide">Destinations</span>
            </div>
            <div className="text-3xl font-bold text-slate-900">{uniqueDestinations}</div>
            <p className="text-xs text-slate-400 mt-1">Unique locations</p>
          </div>

          <div className="flex-1 bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-center gap-2 text-slate-500 mb-1">
              <GlobeIcon className="size-4" />
              <span className="text-xs font-medium uppercase tracking-wide">Completed</span>
            </div>
            <div className="text-3xl font-bold text-slate-900">{completedTrips}</div>
            <p className="text-xs text-slate-400 mt-1">Trips completed</p>
          </div>

          <div className="flex-1 bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-center gap-2 text-slate-500 mb-1">
              <Plane className="size-4" />
              <span className="text-xs font-medium uppercase tracking-wide">Distance</span>
            </div>
            <div className="text-3xl font-bold text-slate-900">
              {totalDistance > 1000
                ? `${(totalDistance / 1000).toFixed(0)}k`
                : Math.round(totalDistance)}
            </div>
            <p className="text-xs text-slate-400 mt-1">Kilometers traveled</p>
          </div>

          {/* Legend */}
          <div className="flex-1 bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-2">Legend</p>
            <div className="space-y-1.5">
              {[
                { label: 'Planned', color: '#f59e0b' },
                { label: 'In Progress', color: '#3b82f6' },
                { label: 'Completed', color: '#22c55e' },
                { label: 'Draft', color: '#64748b' },
                { label: 'Cancelled', color: '#ef4444' },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-xs text-slate-600">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
