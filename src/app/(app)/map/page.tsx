'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { MapPin, Globe as GlobeIcon, Plane, Route, Loader2 } from 'lucide-react';
import { TMBreadcrumb } from '@/components/travelmanager/TMBreadcrumb';

const TravelMap = dynamic(
  () => import('@/components/travelmanager/TravelMap').then(m => ({ default: m.TravelMap })),
  { ssr: false }
);

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

interface HomeLocation {
  latitude: number;
  longitude: number;
  city: string | null;
}

const KM_TO_MILES = 0.621371;

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

function calcDistance(
  filteredTrips: (MapTrip & { latitude: number; longitude: number })[],
  home: HomeLocation | null
): number {
  if (filteredTrips.length === 0) return 0;

  if (home) {
    let dist = 0;
    for (const trip of filteredTrips) {
      dist += haversineDistance(home.latitude, home.longitude, trip.latitude, trip.longitude) * 2;
    }
    return dist * KM_TO_MILES;
  }

  const sorted = [...filteredTrips].sort((a, b) => {
    if (!a.startDate || !b.startDate) return 0;
    return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
  });
  let dist = 0;
  for (let i = 0; i < sorted.length - 1; i++) {
    dist += haversineDistance(
      sorted[i].latitude, sorted[i].longitude,
      sorted[i + 1].latitude, sorted[i + 1].longitude
    );
  }
  return dist * KM_TO_MILES;
}

function formatDistance(miles: number): string {
  if (miles > 1000) return `${(miles / 1000).toFixed(1)}k`;
  return Math.round(miles).toString();
}

export default function MapPage() {
  const [trips, setTrips] = useState<MapTrip[]>([]);
  const [homeLocation, setHomeLocation] = useState<HomeLocation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [tripsRes, userRes] = await Promise.all([
          fetch('/api/trips'),
          fetch('/api/user'),
        ]);

        if (tripsRes.ok) {
          const data = await tripsRes.json();
          const safeData = Array.isArray(data) ? data : [];
          const mapped: MapTrip[] = safeData.map((t: Record<string, unknown>) => ({
            id: t.id as string,
            title: t.title as string,
            destination: (t.destination as string) || null,
            startDate: (t.startDate as string) || null,
            endDate: (t.endDate as string) || null,
            status: t.status as string,
            latitude: (t.latitude as number) ?? null,
            longitude: (t.longitude as number) ?? null,
          }));
          setTrips(mapped);
        }

        if (userRes.ok) {
          const userData = await userRes.json();
          const u = userData.user;
          if (u?.homeLatitude && u?.homeLongitude) {
            setHomeLocation({
              latitude: u.homeLatitude,
              longitude: u.homeLongitude,
              city: u.homeCity || null,
            });
          }
        }
      } catch (error) {
        console.error('Failed to load:', error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const geoTrips = trips.filter(
    (t): t is MapTrip & { latitude: number; longitude: number } =>
      t.latitude !== null && t.longitude !== null
  );

  const uniqueDestinations = new Set(
    geoTrips.map(t => t.destination).filter(Boolean)
  ).size;

  const completedGeoTrips = geoTrips.filter(
    t => t.status === 'COMPLETED' || t.status === 'IN_PROGRESS'
  );
  const travelledDistance = calcDistance(completedGeoTrips, homeLocation);
  const plannedDistance = calcDistance(geoTrips, homeLocation);

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
        <div className="flex-1 rounded-xl overflow-hidden border border-slate-200 relative min-h-[400px]">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
              <div className="text-center">
                <Loader2 className="size-6 text-slate-400 animate-spin mx-auto mb-2" />
                <p className="text-slate-500 text-sm">Loading trips...</p>
              </div>
            </div>
          ) : (
            <>
              <TravelMap trips={trips} homeLocation={homeLocation} />
              {geoTrips.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[1000]">
                  <div className="text-center text-slate-500">
                    <GlobeIcon className="size-10 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No geocoded trips yet</p>
                    <p className="text-xs mt-1 opacity-60">Add destinations to your trips to see them on the map</p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

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
              <span className="text-xs font-medium uppercase tracking-wide">Travelled</span>
            </div>
            <div className="text-3xl font-bold text-slate-900">
              {formatDistance(travelledDistance)}
            </div>
            <p className="text-xs text-slate-400 mt-1">Miles completed</p>
          </div>

          <div className="flex-1 bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-center gap-2 text-slate-500 mb-1">
              <Route className="size-4" />
              <span className="text-xs font-medium uppercase tracking-wide">Planned</span>
            </div>
            <div className="text-3xl font-bold text-slate-900">
              {formatDistance(plannedDistance)}
            </div>
            <p className="text-xs text-slate-400 mt-1">Total miles planned</p>
          </div>

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
