'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { MapPin, Globe as GlobeIcon, Plane, Car, Route, Loader2, Home, Search } from 'lucide-react';
import { TMScreenHeader } from '@/components/travelmanager/TMPageShell';
import { haversineDistance, KM_TO_MILES } from '@/lib/distance';
import { useGeocodingSearch, formatGeoName } from '@/lib/travelmanager/useGeocodingSearch';
import type { GeoResult } from '@/lib/travelmanager/useGeocodingSearch';
import { useTMToast } from '@/components/travelmanager/TMToast';

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

interface MapStop {
  id: string;
  tripId: string;
  name: string;
  latitude: number;
  longitude: number;
  travelMode: string | null;
  sortOrder: number;
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
  const { showToast } = useTMToast();
  const [trips, setTrips] = useState<MapTrip[]>([]);
  const [stops, setStops] = useState<MapStop[]>([]);
  const [homeLocation, setHomeLocation] = useState<HomeLocation | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSavingHome, setIsSavingHome] = useState(false);
  const {
    query: homeQuery,
    setQuery: setHomeQuery,
    results: homeResults,
    isOpen: homeSearchOpen,
    setIsOpen: setHomeSearchOpen,
    isSearching: isSearchingHome,
    containerRef: homeContainerRef,
    handleInputChange: handleHomeInputChange,
    selectResult: selectHomeResult,
  } = useGeocodingSearch();

  useEffect(() => {
    async function load() {
      try {
        const [tripsRes, userRes, stopsRes] = await Promise.all([
          fetch('/api/trips?fields=minimal'),
          fetch('/api/user'),
          fetch('/api/stops'),
        ]);

        if (stopsRes.ok) {
          const stopData = await stopsRes.json();
          setStops(Array.isArray(stopData) ? stopData : []);
        }

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

  async function handleSelectHome(result: GeoResult) {
    const { name: city, lat, lng } = selectHomeResult(result);
    setIsSavingHome(true);
    try {
      const res = await fetch('/api/user', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ homeCity: city, homeLatitude: lat, homeLongitude: lng }),
      });
      if (!res.ok) throw new Error('Failed to save');
      setHomeLocation({ latitude: lat, longitude: lng, city });
      showToast('Home location saved');
    } catch {
      setHomeQuery('');
      showToast('Failed to save home location', 'error');
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

  // Flown vs driven mileage across every trip's route (stop chains plus the
  // implicit home departure/return legs, matching each trip page's Route
  // card). A stop's stored mode wins; otherwise legs over 250 straight-line
  // miles count as flights. Straight-line estimates, so ~ in the UI.
  const modeMiles = (() => {
    const chains = new Map<string, MapStop[]>();
    for (const s of stops) {
      const list = chains.get(s.tripId) ?? [];
      list.push(s);
      chains.set(s.tripId, list);
    }
    let flown = 0;
    let ground = 0;
    const legMiles = (a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) =>
      haversineDistance(a.latitude, a.longitude, b.latitude, b.longitude) * KM_TO_MILES;
    const bucket = (miles: number, storedMode: string | null) => {
      const mode = storedMode ?? (miles > 250 ? 'flight' : 'drive');
      if (mode === 'flight') flown += miles;
      else ground += miles;
    };
    for (const chain of chains.values()) {
      chain.sort((a, b) => a.sortOrder - b.sortOrder);
      const first = chain[0];
      const last = chain[chain.length - 1];
      if (homeLocation && first) {
        const m = legMiles(homeLocation, first);
        if (m > 15) bucket(m, first.travelMode);
      }
      for (let i = 1; i < chain.length; i++) {
        bucket(legMiles(chain[i - 1], chain[i]), chain[i].travelMode);
      }
      if (homeLocation && last) {
        const m = legMiles(last, homeLocation);
        if (m > 15) bucket(m, null);
      }
    }
    return { flown, ground };
  })();

  return (
    <div className="flex flex-col h-full overflow-x-hidden">
      <div className="px-4 md:px-10">
        <TMScreenHeader
          title="Where you travel"
          subtitle={`${trips.length} ${trips.length === 1 ? 'trip' : 'trips'} · ${uniqueDestinations} ${uniqueDestinations === 1 ? 'city' : 'cities'}`}
        />
      </div>

      {!loading && !homeLocation && (
        <div className="mx-4 mb-2 md:mx-6" ref={homeContainerRef}>
          <div
            className="flex flex-col gap-3 rounded-[11px] px-4 py-3 sm:flex-row sm:items-center"
            style={{ background: '#FFFBF2', boxShadow: 'inset 0 0 0 1px #FDE9C8' }}
          >
            <div className="flex shrink-0 items-center gap-2">
              <Home className="size-4 text-tm-accent-text" aria-hidden="true" />
              <span className="text-[13px] font-medium text-tm-accent-text">Set your home location to see travel routes</span>
            </div>
            <div className="relative flex-1 max-w-sm">
              <input
                type="text"
                value={homeQuery}
                onChange={(e) => handleHomeInputChange(e.target.value)}
                onFocus={() => { if (homeResults.length > 0) setHomeSearchOpen(true); }}
                placeholder="Search your home city..."
                className="tm-input pl-8"
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
                <div className="absolute z-50 mt-1 max-h-[200px] w-full overflow-y-auto rounded-[9px] border border-tm-line bg-white shadow-tm-card-hover">
                  {homeResults.map((result, idx) => (
                    <button
                      key={`${result.lat}-${result.lon}-${idx}`}
                      type="button"
                      className="flex w-full items-start gap-2 border-b border-tm-divider px-3 py-2 text-left text-[13px] last:border-b-0 hover:bg-tm-wash"
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
        <div className="relative isolate z-0 h-[50vmax] min-h-[280px] flex-1 overflow-hidden rounded-[14px] border border-tm-line shadow-tm-card md:h-[calc(100vh-14rem)]">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-tm-canvas">
              <div className="text-center">
                <Loader2 className="size-6 text-slate-400 animate-spin mx-auto mb-2" />
                <p className="text-slate-500 text-sm">Loading trips...</p>
              </div>
            </div>
          ) : (
            <>
              <TravelMap trips={trips} homeLocation={homeLocation} stops={stops} />
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
          <div className="flex-1 tm-card p-4">
            <div className="flex items-center gap-2 text-slate-500 mb-1">
              <MapPin className="size-4" />
              <span className="tm-label-upper">Destinations</span>
            </div>
            <div className="text-[26px] font-semibold tracking-[-0.02em] tm-nums text-tm-ink">{uniqueDestinations}</div>
            <p className="mt-1 text-[12px] text-tm-subtle">Unique locations</p>
          </div>

          <div className="flex-1 tm-card p-4">
            <div className="flex items-center gap-2 text-slate-500 mb-1">
              <GlobeIcon className="size-4" />
              <span className="tm-label-upper">Completed</span>
            </div>
            <div className="text-[26px] font-semibold tracking-[-0.02em] tm-nums text-tm-ink">{completedTrips}</div>
            <p className="mt-1 text-[12px] text-tm-subtle">Trips completed</p>
          </div>

          <div className="flex-1 tm-card p-4">
            <div className="flex items-center gap-2 text-slate-500 mb-1">
              <Plane className="size-4" />
              <span className="tm-label-upper">Travelled</span>
            </div>
            <div className="text-[26px] font-semibold tracking-[-0.02em] tm-nums text-tm-ink">
              {formatDistance(travelledDistance)}
            </div>
            <p className="mt-1 text-[12px] text-tm-subtle">Miles completed</p>
          </div>

          {(modeMiles.flown > 0 || modeMiles.ground > 0) && (
            <div className="flex-1 tm-card p-4">
              <p className="tm-label-upper mb-2">By mode</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-[13px] text-tm-body">
                    <Plane className="size-4 text-amber-500" />
                    Flown
                  </span>
                  <span className="text-[13px] font-semibold tm-nums text-tm-ink">
                    ~{formatDistance(modeMiles.flown)} mi
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-[13px] text-tm-body">
                    <Car className="size-4 text-amber-500" />
                    Driven
                  </span>
                  <span className="text-[13px] font-semibold tm-nums text-tm-ink">
                    ~{formatDistance(modeMiles.ground)} mi
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="flex-1 tm-card p-4">
            <div className="flex items-center gap-2 text-slate-500 mb-1">
              <Route className="size-4" />
              <span className="tm-label-upper">Planned</span>
            </div>
            <div className="text-[26px] font-semibold tracking-[-0.02em] tm-nums text-tm-ink">
              {formatDistance(plannedDistance)}
            </div>
            <p className="mt-1 text-[12px] text-tm-subtle">Total miles planned</p>
          </div>

          <div className="col-span-2 sm:col-span-4 lg:col-span-1 tm-card p-4">
            <p className="tm-label-upper mb-2">Markers</p>
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
                  <span className="text-[12px] text-tm-muted">{item.label}</span>
                </div>
              ))}
            </div>
            {homeLocation ? (
              <>
                <p className="tm-label-upper mb-2 mt-3">Routes</p>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-0 border-t-2 border-amber-500" />
                    <span className="text-[12px] text-tm-muted">Flight</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-0 border-t-2 border-emerald-500" />
                    <span className="text-[12px] text-tm-muted">Drive</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-0 border-t-2 border-blue-500" />
                    <span className="text-[12px] text-tm-muted">Connected</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-0 border-t-2 border-dashed border-slate-400" />
                    <span className="text-[12px] text-tm-muted">Return home</span>
                  </div>
                </div>
              </>
            ) : geoTrips.length > 1 && (
              <>
                <p className="tm-label-upper mb-2 mt-3">Routes</p>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-0 border-t-2 border-dashed border-amber-500" />
                    <span className="text-[12px] text-tm-muted">Trip connections</span>
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
