'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin,
  Search,
  X,
  Loader2,
  GripVertical,
  Car,
  Plane,
  TrainFront,
  Bus,
  Ship,
  Footprints,
  Home,
  Trash2,
  Camera,
  type LucideIcon,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { PhotoGallery } from '@/components/travelmanager/PhotoGallery';
import { TMDeleteDialog } from '@/components/travelmanager/TMDeleteDialog';
import { removePhotosForParent } from '@/lib/photos/store';
import { haversineDistance, KM_TO_MILES } from '@/lib/distance';

export interface TripStopData {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  date: string | null;
  notes: string | null;
  travelMode: string | null;
  sortOrder: number;
}

/** A travel leg INTO stop `toId` from the previous point in the route. */
export interface RouteLeg {
  toId: string;
  mode: string;
  miles: number;
  /** Real road geometry ([lat,lng][]) for driving legs; null = straight line */
  geometry: [number, number][] | null;
  /** True when miles is a straight-line estimate rather than road distance */
  approx: boolean;
  /** True for the implicit return-home leg (derived, not a stored stop) */
  auto?: boolean;
}

/** Synthetic id for the derived home point appended to the route. */
export const HOME_STOP_ID = '__home__';
/** Synthetic id for the derived home point the route departs from. */
export const HOME_START_STOP_ID = '__home_start__';

interface GeocodeResult {
  display_name: string;
  lat: string;
  lon: string;
}

interface AirportResult {
  iata: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
}

interface TripStopsProps {
  tripId: string;
  tripDestination?: string | null;
  tripLatitude?: number | null;
  tripLongitude?: number | null;
  /** Persisted opt-outs for the assumed home departure/return legs */
  hideHomeDeparture?: boolean;
  hideHomeReturn?: boolean;
  onRouteChange?: (stops: TripStopData[], legs: RouteLeg[]) => void;
}

const MODES: { key: string; label: string; icon: LucideIcon; roadRouted: boolean }[] = [
  { key: 'drive', label: 'Drove', icon: Car, roadRouted: true },
  { key: 'flight', label: 'Flew', icon: Plane, roadRouted: false },
  { key: 'train', label: 'Train', icon: TrainFront, roadRouted: false },
  { key: 'bus', label: 'Bus', icon: Bus, roadRouted: true },
  { key: 'boat', label: 'Boat', icon: Ship, roadRouted: false },
  { key: 'walk', label: 'Walked', icon: Footprints, roadRouted: true },
];

const modeConfig = (key: string | null) =>
  MODES.find((m) => m.key === key) ?? MODES[0];

/** Beyond this straight-line distance the auto home leg assumes a flight. */
const AUTO_HOME_FLIGHT_MILES = 250;
/** Within this distance of home the route is considered "already home". */
const HOME_ARRIVED_MILES = 15;

function straightMiles(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  return haversineDistance(a.latitude, a.longitude, b.latitude, b.longitude) * KM_TO_MILES;
}

/**
 * The trip route: an ordered list of places visited, how you got to each
 * one, and real road mileage for driven legs (straight-line for flights).
 * Searching matches both places (geocoder) and airports (IATA database) —
 * airports add as flight legs. If the route doesn't end near the user's
 * home location, a final "back home" leg is drawn automatically.
 */
export function TripStops({
  tripId,
  tripDestination,
  tripLatitude,
  tripLongitude,
  hideHomeDeparture = false,
  hideHomeReturn = false,
  onRouteChange,
}: TripStopsProps) {
  const [hideDeparture, setHideDeparture] = useState(hideHomeDeparture);
  const [hideReturn, setHideReturn] = useState(hideHomeReturn);
  const [stops, setStops] = useState<TripStopData[]>([]);
  const [legs, setLegs] = useState<RouteLeg[]>([]);
  const [home, setHome] = useState<{ city: string; latitude: number; longitude: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [placeResults, setPlaceResults] = useState<GeocodeResult[]>([]);
  const [airportResults, setAirportResults] = useState<AirportResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);
  const [modePickerFor, setModePickerFor] = useState<string | null>(null);
  const [photosOpenFor, setPhotosOpenFor] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TripStopData | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  // Road-route cache: "fromLat,fromLng-toLat,toLng" → miles + geometry
  const roadCache = useRef(new Map<string, { miles: number; geometry: [number, number][] }>());

  const onRouteChangeRef = useRef(onRouteChange);
  onRouteChangeRef.current = onRouteChange;

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/trips/${tripId}/stops`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (!cancelled) setStops(Array.isArray(data) ? data : []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    // Home base for the automatic return leg
    fetch('/api/user')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const u = data?.user;
        if (!cancelled && u?.homeLatitude != null && u?.homeLongitude != null) {
          setHome({ city: u.homeCity ?? 'Home', latitude: u.homeLatitude, longitude: u.homeLongitude });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [tripId]);

  // Compute legs whenever the route changes: road miles for drivable modes
  // (via the OSRM proxy, cached per coordinate pair), straight-line otherwise.
  // Appends the implicit home leg when the route ends away from home.
  useEffect(() => {
    let cancelled = false;

    async function roadLeg(from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }) {
      const key = `${from.latitude},${from.longitude}-${to.latitude},${to.longitude}`;
      let road = roadCache.current.get(key);
      if (!road) {
        try {
          const res = await fetch(
            `/api/route/driving?from=${from.latitude},${from.longitude}&to=${to.latitude},${to.longitude}`
          );
          if (res.ok) {
            const data = await res.json();
            road = {
              miles: (data.distanceMeters / 1000) * KM_TO_MILES,
              geometry: data.geometry as [number, number][],
            };
            roadCache.current.set(key, road);
          }
        } catch {
          // fall through to straight-line estimate
        }
      }
      return road ?? null;
    }

    async function compute() {
      const next: RouteLeg[] = [];
      // A stop's stored mode wins; otherwise default by distance — long
      // hops read as flights, short ones as drives.
      const effectiveMode = (stop: TripStopData, straight: number) =>
        stop.travelMode ?? (straight > AUTO_HOME_FLIGHT_MILES ? 'flight' : 'drive');

      async function buildLeg(
        from: { latitude: number; longitude: number },
        to: { latitude: number; longitude: number },
        toId: string,
        mode: string,
        auto?: boolean
      ): Promise<RouteLeg | null> {
        if (modeConfig(mode).roadRouted) {
          const road = await roadLeg(from, to);
          if (cancelled) return null;
          return road
            ? { toId, mode, miles: road.miles, geometry: road.geometry, approx: false, auto }
            : { toId, mode, miles: straightMiles(from, to), geometry: null, approx: true, auto };
        }
        return { toId, mode, miles: straightMiles(from, to), geometry: null, approx: false, auto };
      }

      // Departure leg FROM home into the first place — shown whenever home
      // is set, the trip doesn't start where you live, and the trip hasn't
      // opted out (e.g. it began where another trip ended).
      const first = stops[0];
      const departsFromHome =
        !hideDeparture && home && first && straightMiles(home, first) > HOME_ARRIVED_MILES;
      if (home && first && departsFromHome) {
        const straight = straightMiles(home, first);
        const leg = await buildLeg(home, first, first.id, effectiveMode(first, straight));
        if (cancelled) return;
        if (leg) next.push(leg);
      }

      for (let i = 1; i < stops.length; i++) {
        const from = stops[i - 1];
        const to = stops[i];
        const leg = await buildLeg(from, to, to.id, effectiveMode(to, straightMiles(from, to)));
        if (cancelled) return;
        if (leg) next.push(leg);
      }

      // Implicit "back home" leg — automatic unless the route already ends
      // near home, home isn't set, or the trip opted out.
      let returnsHome = false;
      const last = stops[stops.length - 1];
      if (!hideReturn && home && last && straightMiles(last, home) > HOME_ARRIVED_MILES) {
        const straight = straightMiles(last, home);
        const mode = straight > AUTO_HOME_FLIGHT_MILES ? 'flight' : 'drive';
        const leg = await buildLeg(last, home, HOME_STOP_ID, mode, true);
        if (cancelled) return;
        if (leg) {
          next.push(leg);
          returnsHome = true;
        }
      }

      const homeEntry = (id: string, sortOrder: number): TripStopData => ({
        id,
        name: `Home — ${home!.city.split(',')[0]}`,
        latitude: home!.latitude,
        longitude: home!.longitude,
        date: null,
        notes: null,
        travelMode: null,
        sortOrder,
      });
      const routeStops: TripStopData[] = [
        ...(departsFromHome ? [homeEntry(HOME_START_STOP_ID, -1)] : []),
        ...stops,
        ...(returnsHome ? [homeEntry(HOME_STOP_ID, stops.length)] : []),
      ];

      if (!cancelled) {
        setLegs(next);
        onRouteChangeRef.current?.(routeStops, next);
      }
    }

    compute();
    return () => {
      cancelled = true;
    };
  }, [stops, home, hideDeparture, hideReturn]);

  // Debounced search: places (geocoder) + airports (IATA database) in parallel
  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setPlaceResults([]);
      setAirportResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const [places, airports] = await Promise.all([
          fetch(`/api/geocode/search?q=${encodeURIComponent(q)}`, { signal: controller.signal })
            .then((r) => (r.ok ? r.json() : []))
            .catch(() => []),
          fetch(`/api/airports/search?q=${encodeURIComponent(q)}`, { signal: controller.signal })
            .then((r) => (r.ok ? r.json() : []))
            .catch(() => []),
        ]);
        if (!controller.signal.aborted) {
          setPlaceResults(Array.isArray(places) ? places.slice(0, 4) : []);
          setAirportResults(Array.isArray(airports) ? airports.slice(0, 3) : []);
        }
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  // Close search suggestions / mode picker on outside click
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!searchRef.current?.contains(e.target as Node)) {
        setPlaceResults([]);
        setAirportResults([]);
      }
      setModePickerFor(null);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const createStop = async (name: string, latitude: number, longitude: number, travelMode?: string) => {
    setAdding(true);
    try {
      const res = await fetch(`/api/trips/${tripId}/stops`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // No explicit mode → leave null so the leg smart-defaults by
        // distance (long hops read as flights, short ones as drives).
        body: JSON.stringify({ name, latitude, longitude, ...(travelMode ? { travelMode } : {}) }),
      });
      if (res.ok) {
        const stop = await res.json();
        setStops((prev) => [...prev, stop]);
      }
    } catch {
      // request failed — list simply stays as-is
    } finally {
      setAdding(false);
    }
  };

  const clearSearch = () => {
    setPlaceResults([]);
    setAirportResults([]);
    setQuery('');
  };

  const addFromSearch = (r: GeocodeResult) => {
    clearSearch();
    // First two segments of the display name identify the place well
    const name = r.display_name.split(',').slice(0, 2).join(',').trim();
    createStop(name, Number(r.lat), Number(r.lon));
  };

  const addFromAirport = (a: AirportResult) => {
    clearSearch();
    const label = a.city ? `${a.city} (${a.iata})` : `${a.name} (${a.iata})`;
    createStop(label, a.lat, a.lng, 'flight');
  };

  const removeStop = async (stopId: string) => {
    const prev = stops;
    setStops(stops.filter((s) => s.id !== stopId));
    try {
      const res = await fetch(`/api/trips/${tripId}/stops/${stopId}`, { method: 'DELETE' });
      if (!res.ok) {
        setStops(prev);
        return;
      }
      if (photosOpenFor === stopId) setPhotosOpenFor(null);
      removePhotosForParent('stop', stopId);
    } catch {
      setStops(prev);
    }
  };

  const setMode = async (stopId: string, mode: string) => {
    setModePickerFor(null);
    const prev = stops;
    setStops(stops.map((s) => (s.id === stopId ? { ...s, travelMode: mode } : s)));
    try {
      const res = await fetch(`/api/trips/${tripId}/stops/${stopId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ travelMode: mode }),
      });
      if (!res.ok) setStops(prev);
    } catch {
      setStops(prev);
    }
  };

  // Persisted per trip so the opt-out survives reloads (e.g. a trip that
  // began at another trip's endpoint rather than at home).
  const setHomeLegHidden = async (which: 'departure' | 'return', hidden: boolean) => {
    if (which === 'departure') setHideDeparture(hidden);
    else setHideReturn(hidden);
    try {
      await fetch(`/api/trips/${tripId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          which === 'departure' ? { hideHomeDeparture: hidden } : { hideHomeReturn: hidden }
        ),
      });
    } catch {
      // optimistic — server truth wins on next load
    }
  };

  const clearRoute = async () => {
    setConfirmClear(false);
    const prev = stops;
    setStops([]);
    try {
      const res = await fetch(`/api/trips/${tripId}/stops`, { method: 'DELETE' });
      if (!res.ok) {
        setStops(prev);
        return;
      }
      setPhotosOpenFor(null);
      for (const s of prev) removePhotosForParent('stop', s.id);
    } catch {
      setStops(prev);
    }
  };

  const persistOrder = async (next: TripStopData[]) => {
    const prev = stops;
    setStops(next.map((s, i) => ({ ...s, sortOrder: i })));
    try {
      const res = await fetch('/api/stops/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tripId, orderedIds: next.map((s) => s.id) }),
      });
      if (!res.ok) setStops(prev);
    } catch {
      setStops(prev);
    }
  };

  // HTML5 drag-and-drop, same pattern as ItineraryTimeline.
  // TODO(a11y): shared follow-up with the itinerary — keyboard reordering.
  const handleDrop = (e: React.DragEvent, dropId: string) => {
    e.preventDefault();
    const fromId = draggedId;
    setDraggedId(null);
    setDragOverId(null);
    if (!fromId || fromId === dropId) return;
    const fromIdx = stops.findIndex((s) => s.id === fromId);
    const toIdx = stops.findIndex((s) => s.id === dropId);
    if (fromIdx === -1 || toIdx === -1) return;
    const next = [...stops];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    persistOrder(next);
  };

  const destinationAlreadyAdded =
    !tripDestination ||
    stops.some((s) => s.name.toLowerCase() === tripDestination.toLowerCase().split(',').slice(0, 2).join(',').trim().toLowerCase());

  const canAddDestination =
    tripDestination && tripLatitude != null && tripLongitude != null && !destinationAlreadyAdded;

  const homeLeg = legs.find((l) => l.toId === HOME_STOP_ID);
  const totalMiles = legs.reduce((sum, l) => sum + l.miles, 0);
  const hasApprox = legs.some((l) => l.approx);
  // Mileage broken down by travel mode (only modes actually used)
  const modeTotals = MODES.map((m) => ({
    ...m,
    miles: legs.filter((l) => l.mode === m.key).reduce((s, l) => s + l.miles, 0),
  })).filter((m) => m.miles > 0);
  const hasSuggestions = placeResults.length > 0 || airportResults.length > 0;

  const formatMiles = (m: number) =>
    m >= 100 ? Math.round(m).toLocaleString() : m.toFixed(m >= 10 ? 0 : 1);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-600">
          Route
        </h3>
        <div className="flex items-center gap-2">
          {legs.length > 0 && (
            <span className="text-xs text-slate-400">
              {stops.length} {stops.length === 1 ? 'place' : 'places'} ·{' '}
              {hasApprox ? '~' : ''}{formatMiles(totalMiles)} mi
            </span>
          )}
          {stops.length > 0 && (
            confirmClear ? (
              <span className="flex items-center gap-1 text-xs">
                <span className="text-slate-500">Clear route?</span>
                <button
                  type="button"
                  onClick={clearRoute}
                  className="rounded-md px-1.5 py-0.5 font-medium text-red-600 transition-colors hover:bg-red-50 active:bg-red-50"
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  className="rounded-md px-1.5 py-0.5 text-slate-500 transition-colors hover:bg-slate-100 active:bg-slate-100"
                >
                  No
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                aria-label="Clear the whole route"
                className="flex size-6 items-center justify-center rounded-md text-slate-300 transition-colors hover:bg-red-50 hover:text-red-500 active:bg-red-50 active:text-red-500"
              >
                <Trash2 className="size-3.5" />
              </button>
            )
          )}
        </div>
      </div>

      {/* Mileage by mode — how much of this trip was flown vs driven */}
      {modeTotals.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {modeTotals.map((m) => {
            const MIcon = m.icon;
            return (
              <span
                key={m.key}
                className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600 ring-1 ring-inset ring-slate-200/70"
              >
                <MIcon className="size-3 text-amber-500" />
                {m.label} {formatMiles(m.miles)} mi
              </span>
            );
          })}
        </div>
      )}

      {/* Search-to-add — matches places AND airports (type a city or code like HSV) */}
      <div ref={searchRef} className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Add a place or airport…"
          className="pl-9"
          aria-label="Search for a place or airport to add"
          disabled={adding}
        />
        {(searching || adding) && (
          <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-amber-500" />
        )}
        <AnimatePresence>
          {hasSuggestions && (
            <motion.ul
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="absolute z-20 mt-1.5 max-h-64 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-card-hover"
            >
              {airportResults.map((a) => (
                <li key={`ap-${a.iata}`}>
                  <button
                    type="button"
                    onClick={() => addFromAirport(a)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-amber-50 active:bg-amber-50"
                  >
                    <Plane className="size-3.5 shrink-0 text-amber-500" />
                    <kbd className="rounded bg-slate-100 px-1 font-mono text-[10px] font-semibold text-slate-500">
                      {a.iata}
                    </kbd>
                    <span className="truncate">
                      {a.city ? `${a.city} — ${a.name}` : a.name}
                    </span>
                  </button>
                </li>
              ))}
              {airportResults.length > 0 && placeResults.length > 0 && (
                <li aria-hidden="true" className="mx-3 my-1 border-t border-slate-100" />
              )}
              {placeResults.map((r, i) => (
                <li key={`pl-${r.lat}-${r.lon}-${i}`}>
                  <button
                    type="button"
                    onClick={() => addFromSearch(r)}
                    className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-amber-50 active:bg-amber-50"
                  >
                    <MapPin className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
                    <span className="line-clamp-2">{r.display_name}</span>
                  </button>
                </li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>
      </div>

      {/* Pull the trip's destination into the orderable route */}
      {canAddDestination && (
        <button
          type="button"
          onClick={() => createStop(
            tripDestination.split(',').slice(0, 2).join(',').trim(),
            tripLatitude,
            tripLongitude
          )}
          disabled={adding}
          className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-dashed border-amber-300 bg-amber-50/50 px-3 py-1 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-50 active:bg-amber-100"
        >
          <MapPin className="size-3" />
          Add “{tripDestination.split(',')[0]}” to the route
        </button>
      )}

      {/* Route list */}
      {loading ? (
        <div className="mt-3 space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-9 animate-pulse rounded-lg bg-slate-100" />
          ))}
        </div>
      ) : stops.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400">
          No places yet — add the spots you visited, in the order you went.
        </p>
      ) : (
        <ul className="mt-3">
          {/* Implicit departure from home — automatic when the trip doesn't start at home */}
          {home && !hideDeparture && legs.some((l) => l.toId === stops[0]?.id) && (
            <li className="group/homestart">
              <div className="flex items-center gap-2 rounded-lg px-2 py-1.5">
                <span className="size-3.5 shrink-0" aria-hidden="true" />
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-violet-100">
                  <Home className="size-3 text-violet-600" />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-slate-500">
                  Home — {home.city.split(',')[0]}
                </span>
                <button
                  type="button"
                  onClick={() => setHomeLegHidden('departure', true)}
                  aria-label="Remove the assumed departure from home"
                  title="Didn't start this trip from home? Remove this leg."
                  className="flex size-6 shrink-0 items-center justify-center rounded-md text-slate-300 transition-colors hover:bg-red-50 hover:text-red-500 active:bg-red-50 active:text-red-500"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            </li>
          )}
          <AnimatePresence initial={false}>
            {stops.map((stop, i) => {
              const leg = legs.find((l) => l.toId === stop.id);
              const cfg = modeConfig(leg?.mode ?? stop.travelMode);
              const LegIcon = cfg.icon;
              return (
                <motion.li
                  key={stop.id}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.18 }}
                >
                  {/* Leg chip: how you got here + distance (first place gets
                      its leg from home when home is set) */}
                  {leg && (
                    <div className="relative ml-[21px] flex items-center gap-2 border-l-2 border-dotted border-slate-200 py-1 pl-4">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setModePickerFor(modePickerFor === stop.id ? null : stop.id);
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-500 transition-colors hover:bg-amber-100 hover:text-amber-700 active:bg-amber-100"
                        aria-label={`Travel mode to ${stop.name}: ${cfg.label}. Click to change.`}
                      >
                        <LegIcon className="size-3" />
                        {`${leg.approx ? '~' : ''}${formatMiles(leg.miles)} mi`}
                      </button>
                      {modePickerFor === stop.id && (
                        <div
                          className="absolute left-8 top-7 z-30 flex gap-0.5 rounded-lg border border-slate-200 bg-white p-1 shadow-card-hover"
                          onMouseDown={(e) => e.stopPropagation()}
                        >
                          {MODES.map((m) => {
                            const MIcon = m.icon;
                            const active = leg.mode === m.key;
                            return (
                              <button
                                key={m.key}
                                type="button"
                                title={m.label}
                                aria-label={m.label}
                                onClick={() => setMode(stop.id, m.key)}
                                className={`flex size-8 items-center justify-center rounded-md transition-colors ${
                                  active
                                    ? 'bg-amber-100 text-amber-600'
                                    : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600 active:bg-slate-100'
                                }`}
                              >
                                <MIcon className="size-4" />
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Stop row — draggable to reorder */}
                  <div
                    draggable
                    onDragStart={(e) => {
                      setDraggedId(stop.id);
                      e.dataTransfer.effectAllowed = 'move';
                      try { e.dataTransfer.setData('text/plain', stop.id); } catch { /* some browsers throw */ }
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      if (stop.id !== dragOverId) setDragOverId(stop.id);
                    }}
                    onDragLeave={() => { if (dragOverId === stop.id) setDragOverId(null); }}
                    onDrop={(e) => handleDrop(e, stop.id)}
                    onDragEnd={() => { setDraggedId(null); setDragOverId(null); }}
                    className={`group flex cursor-grab items-center gap-2 rounded-lg px-2 py-1.5 transition-colors active:cursor-grabbing ${
                      draggedId === stop.id
                        ? 'opacity-40'
                        : dragOverId === stop.id
                          ? 'bg-amber-50 ring-1 ring-inset ring-amber-200'
                          : 'hover:bg-slate-50'
                    }`}
                  >
                    <GripVertical className="size-3.5 shrink-0 text-slate-300 opacity-60 transition-opacity group-hover:opacity-100" />
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[10px] font-bold text-amber-700">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-slate-700" title={stop.name}>
                      {stop.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPhotosOpenFor(photosOpenFor === stop.id ? null : stop.id)}
                      onMouseDown={(e) => e.stopPropagation()}
                      aria-label={`Photos for ${stop.name}`}
                      className={`flex size-6 shrink-0 items-center justify-center rounded-md transition-colors ${
                        photosOpenFor === stop.id
                          ? 'bg-amber-100 text-amber-600'
                          : 'text-slate-300 hover:bg-amber-50 hover:text-amber-500 active:bg-amber-50 active:text-amber-500'
                      }`}
                    >
                      <Camera className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(stop)}
                      aria-label={`Remove ${stop.name}`}
                      className="flex size-6 shrink-0 items-center justify-center rounded-md text-slate-300 transition-colors hover:bg-red-50 hover:text-red-500 active:bg-red-50 active:text-red-500"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>

                  {/* On-device photos for this place */}
                  {photosOpenFor === stop.id && (
                    <div className="ml-9 mr-2 rounded-lg bg-slate-50 p-2">
                      <PhotoGallery
                        tripId={tripId}
                        parentType="stop"
                        parentId={stop.id}
                        compact
                      />
                    </div>
                  )}
                </motion.li>
              );
            })}
          </AnimatePresence>

          {/* Implicit return home — automatic when the route ends away from home */}
          {homeLeg && home && (
            <li>
              <div className="relative ml-[21px] flex items-center gap-2 border-l-2 border-dotted border-slate-200 py-1 pl-4">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-2.5 py-0.5 text-[11px] font-medium text-violet-500">
                  {(() => {
                    const HIcon = modeConfig(homeLeg.mode).icon;
                    return <HIcon className="size-3" />;
                  })()}
                  {`${homeLeg.approx ? '~' : ''}${formatMiles(homeLeg.miles)} mi · auto`}
                </span>
              </div>
              <div className="flex items-center gap-2 rounded-lg px-2 py-1.5">
                <span className="size-3.5 shrink-0" aria-hidden="true" />
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-violet-100">
                  <Home className="size-3 text-violet-600" />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-slate-500">
                  Home — {home.city.split(',')[0]}
                </span>
                <button
                  type="button"
                  onClick={() => setHomeLegHidden('return', true)}
                  aria-label="Remove the assumed return home"
                  title="Didn't head home after this trip? Remove this leg."
                  className="flex size-6 shrink-0 items-center justify-center rounded-md text-slate-300 transition-colors hover:bg-red-50 hover:text-red-500 active:bg-red-50 active:text-red-500"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            </li>
          )}

          {/* Restore removed home legs */}
          {home && stops.length > 0 && (hideDeparture || hideReturn) && (
            <li className="mt-1 flex gap-1.5 px-2">
              {hideDeparture && (
                <button
                  type="button"
                  onClick={() => setHomeLegHidden('departure', false)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-violet-300 bg-violet-50/50 px-2.5 py-0.5 text-[11px] font-medium text-violet-600 transition-colors hover:bg-violet-50 active:bg-violet-100"
                >
                  <Home className="size-3" />
                  Show departure from home
                </button>
              )}
              {hideReturn && (
                <button
                  type="button"
                  onClick={() => setHomeLegHidden('return', false)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-violet-300 bg-violet-50/50 px-2.5 py-0.5 text-[11px] font-medium text-violet-600 transition-colors hover:bg-violet-50 active:bg-violet-100"
                >
                  <Home className="size-3" />
                  Show return home
                </button>
              )}
            </li>
          )}
        </ul>
      )}

      <TMDeleteDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) removeStop(deleteTarget.id);
          setDeleteTarget(null);
        }}
        title="Remove this stop?"
        description={
          deleteTarget
            ? `"${deleteTarget.name}" will be removed from the route, along with any photos you attached to it.`
            : ''
        }
      />
    </div>
  );
}
