'use client';

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { MapPin, Globe as GlobeIcon, Plane, Route, Loader2, Home, Search } from 'lucide-react';
import { TMBreadcrumb } from '@/components/travelmanager/TMBreadcrumb';
import { haversineDistance, KM_TO_MILES } from '@/lib/distance';

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

interface GeoResult {
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  address: Record<string, string>;
}

function formatGeoName(result: GeoResult): string {
  const addr = result.address;
  const city = addr.city || addr.town || addr.village || addr.hamlet || '';
  const state = addr.state || '';
  const country = addr.country || '';
  return [city, state, country].filter(Boolean).join(', ') || result.display_name;
}

function calcDistance(
  filteredTrips: (MapTrip & { latitude: number; longitude: number })[],
  home: HomeLocation | null
): number {
  if (filteredTrips.length === 0) return 0;

  const sorted = [...filteredTrips].sort((a, b) => {
    if (!a.startDate || !b.startDate) return 0;
    return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
  });

  function tripLegDistance(
    fromLat: number, fromLng: number,
    toLat: number, toLng: number,
    trip: MapTrip
  ): number {
    if (
      trip.transportMode === 'FLIGHT' &&
      trip.departureAirportLat != null && trip.departureAirportLng != null &&
      trip.arrivalAirportLat != null && trip.arrivalAirportLng != null
    ) {
      return (
        haversineDistance(fromLat, fromLng, trip.departureAirportLat, trip.departureAirportLng) +
        haversineDistance(trip.departureAirportLat, trip.departureAirportLng, trip.arrivalAirportLat, trip.arrivalAirportLng) +
        haversineDistance(trip.arrivalAirportLat, trip.arrivalAirportLng, toLat, toLng)
      );
    }
    return haversineDistance(fromLat, fromLng, toLat, toLng);
  }

  if (home) {
    let dist = tripLegDistance(home.latitude, home.longitude, sorted[0].latitude, sorted[0].longitude, sorted[0]);
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      const overlaps = prev.endDate != null && curr.startDate != null
        && new Date(prev.endDate) >= new Date(curr.startDate);
      if (overlaps) {
        dist += haversineDistance(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
      } else {
        dist += haversineDistance(prev.latitude, prev.longitude, home.latitude, home.longitude);
        dist += tripLegDistance(home.latitude, home.longitude, curr.latitude, curr.longitude, curr);
      }
    }
    const last = sorted[sorted.length - 1];
    dist += haversineDistance(last.latitude, last.longitude, home.latitude, home.longitude);
    return dist * KM_TO_MILES;
  }

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
  const [homeQuery, setHomeQuery] = useState('');
  const [homeResults, setHomeResults] = useState<GeoResult[]>([]);
  const [homeSearchOpen, setHomeSearchOpen] = useState(false);
  const [isSearchingHome, setIsSearchingHome] = useState(false);
  const [isSavingHome, setIsSavingHome] = useState(false);
  const homeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const homeLastFetchRef = useRef(0);
  const homeContainerRef = useRef<HTMLDivElement>(null);

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
            transportMode: (t.transportMode as string) || null,
            departureAirportCode: (t.departureAirportCode as string) || null,
            departureAirportLat: (t.departureAirportLat as number) ?? null,
            departureAirportLng: (t.departureAirportLng as number) ?? null,
            arrivalAirportCode: (t.arrivalAirportCode as string) || null,
            arrivalAirportLat: (t.arrivalAirportLat as number) ?? null,
            arrivalAirportLng: (t.arrivalAirportLng as number) ?? null,
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

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (homeContainerRef.current && !homeContainerRef.current.contains(e.target as Node)) {
        setHomeSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function searchHomeLocation(q: string) {
    if (q.length < 3) {
      setHomeResults([]);
      setHomeSearchOpen(false);
      return;
    }
    const now = Date.now();
    const elapsed = now - homeLastFetchRef.current;
    if (elapsed < 1000) {
      await new Promise(resolve => setTimeout(resolve, 1000 - elapsed));
    }
    setIsSearchingHome(true);
    try {
      homeLastFetchRef.current = Date.now();
      const res = await fetch(`/api/geocode/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data: GeoResult[] = await res.json();
        setHomeResults(data);
        setHomeSearchOpen(data.length > 0);
      }
    } catch { /* silent */ } finally {
      setIsSearchingHome(false);
    }
  }

  function handleHomeInputChange(val: string) {
    setHomeQuery(val);
    if (homeDebounceRef.current) clearTimeout(homeDebounceRef.current);
    homeDebounceRef.current = setTimeout(() => searchHomeLocation(val), 400);
  }

  async function handleSelectHome(result: GeoResult) {
    const city = formatGeoName(result);
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    setHomeQuery(city);
    setHomeSearchOpen(false);
    setHomeResults([]);
    setIsSavingHome(true);
    try {
      const res = await fetch('/api/user', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ homeCity: city, homeLatitude: lat, homeLongitude: lng }),
      });
      if (!res.ok) throw new Error('Failed to save');
      setHomeLocation({ latitude: lat, longitude: lng, city });
    } catch {
      setHomeQuery('');
    } finally {
      setIsSavingHome(false);
    }
  }

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
    <div className="flex flex-col h-full overflow-x-hidden">
      <div className="px-4 pt-4 pb-2 md:px-6 md:pt-6">
        <TMBreadcrumb items={[
          { label: 'Travel Manager', href: '/' },
          { label: 'Map' },
        ]} />
        <h1 className="text-2xl font-bold text-slate-900">Travel Map</h1>
        <p className="text-sm text-slate-500 mt-1">Your destinations around the world</p>
      </div>

      {!loading && !homeLocation && (
        <div className="mx-4 mb-2 md:mx-6" ref={homeContainerRef}>
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2 shrink-0">
              <Home className="size-4 text-amber-600" />
              <span className="text-sm font-medium text-amber-800">Set your home location to see travel routes</span>
            </div>
            <div className="relative flex-1 max-w-sm">
              <input
                type="text"
                value={homeQuery}
                onChange={(e) => handleHomeInputChange(e.target.value)}
                onFocus={() => { if (homeResults.length > 0) setHomeSearchOpen(true); }}
                placeholder="Search your home city..."
                className="w-full rounded-lg border border-amber-300 bg-white px-3 py-1.5 pl-8 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                autoComplete="off"
              />
              <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                {isSearchingHome || isSavingHome ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Search className="size-3.5" />
                )}
              </div>
              {homeSearchOpen && homeResults.length > 0 && (
                <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-[200px] overflow-y-auto">
                  {homeResults.map((result, idx) => (
                    <button
                      key={`${result.lat}-${result.lon}-${idx}`}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 border-b border-slate-100 last:border-b-0 flex items-start gap-2"
                      onClick={() => handleSelectHome(result)}
                    >
                      <MapPin className="size-3.5 text-amber-500 mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <div className="font-medium text-slate-800 truncate">{formatGeoName(result)}</div>
                        <div className="text-xs text-slate-400 truncate">{result.display_name}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col lg:flex-row gap-4 p-4 min-h-0">
        <div className="flex-1 rounded-xl overflow-hidden border border-slate-200 relative h-[50vmax] min-h-[240px] md:h-[calc(100vh-12rem)] z-0 isolate">
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

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-1 lg:w-72 lg:flex lg:flex-col gap-3">
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

          <div className="col-span-2 sm:col-span-4 lg:col-span-1 bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-2">Markers</p>
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
            {homeLocation ? (
              <>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-2 mt-3">Routes</p>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-0 border-t-2 border-amber-500" />
                    <span className="text-xs text-slate-600">Flight</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-0 border-t-2 border-emerald-500" />
                    <span className="text-xs text-slate-600">Drive</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-0 border-t-2 border-blue-500" />
                    <span className="text-xs text-slate-600">Connected</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-0 border-t-2 border-dashed border-slate-400" />
                    <span className="text-xs text-slate-600">Return home</span>
                  </div>
                </div>
              </>
            ) : geoTrips.length > 1 && (
              <>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-2 mt-3">Routes</p>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-0 border-t-2 border-dashed border-amber-500" />
                    <span className="text-xs text-slate-600">Trip connections</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
