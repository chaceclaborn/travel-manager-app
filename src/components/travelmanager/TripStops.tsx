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
  type LucideIcon,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
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
}

interface GeocodeResult {
  display_name: string;
  lat: string;
  lon: string;
}

interface TripStopsProps {
  tripId: string;
  tripDestination?: string | null;
  tripLatitude?: number | null;
  tripLongitude?: number | null;
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

function straightMiles(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  return haversineDistance(a.latitude, a.longitude, b.latitude, b.longitude) * KM_TO_MILES;
}

/**
 * The trip route: an ordered list of places visited, how you got to each
 * one, and real road mileage for driven legs (straight-line for flights).
 * Add via one search box; drag rows to reorder; click a leg chip to change
 * the travel mode. The trip's own destination can be pulled in as a place
 * so the whole route lives in one orderable list.
 */
export function TripStops({
  tripId,
  tripDestination,
  tripLatitude,
  tripLongitude,
  onRouteChange,
}: TripStopsProps) {
  const [stops, setStops] = useState<TripStopData[]>([]);
  const [legs, setLegs] = useState<RouteLeg[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);
  const [modePickerFor, setModePickerFor] = useState<string | null>(null);
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
    return () => {
      cancelled = true;
    };
  }, [tripId]);

  // Compute legs whenever the route changes: road miles for drivable modes
  // (via the OSRM proxy, cached per coordinate pair), straight-line otherwise.
  useEffect(() => {
    let cancelled = false;

    async function compute() {
      const next: RouteLeg[] = [];
      for (let i = 1; i < stops.length; i++) {
        const from = stops[i - 1];
        const to = stops[i];
        const mode = to.travelMode ?? 'drive';
        const cfg = modeConfig(mode);
        if (cfg.roadRouted) {
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
          if (cancelled) return;
          next.push(
            road
              ? { toId: to.id, mode, miles: road.miles, geometry: road.geometry, approx: false }
              : { toId: to.id, mode, miles: straightMiles(from, to), geometry: null, approx: true }
          );
        } else {
          next.push({
            toId: to.id,
            mode,
            miles: straightMiles(from, to),
            geometry: null,
            approx: false,
          });
        }
      }
      if (!cancelled) {
        setLegs(next);
        onRouteChangeRef.current?.(stops, next);
      }
    }

    compute();
    return () => {
      cancelled = true;
    };
  }, [stops]);

  // Debounced place search against the existing geocode proxy
  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/geocode/search?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        if (res.ok) {
          const data = await res.json();
          if (!controller.signal.aborted) setResults(Array.isArray(data) ? data : []);
        }
      } catch {
        // aborted or offline — suggestions simply don't appear
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
      if (!searchRef.current?.contains(e.target as Node)) setResults([]);
      setModePickerFor(null);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const createStop = async (name: string, latitude: number, longitude: number) => {
    setAdding(true);
    try {
      const res = await fetch(`/api/trips/${tripId}/stops`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, latitude, longitude, travelMode: 'drive' }),
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

  const addFromSearch = (r: GeocodeResult) => {
    setResults([]);
    setQuery('');
    // First two segments of the display name identify the place well
    const name = r.display_name.split(',').slice(0, 2).join(',').trim();
    createStop(name, Number(r.lat), Number(r.lon));
  };

  const removeStop = async (stopId: string) => {
    const prev = stops;
    setStops(stops.filter((s) => s.id !== stopId));
    try {
      const res = await fetch(`/api/trips/${tripId}/stops/${stopId}`, { method: 'DELETE' });
      if (!res.ok) setStops(prev);
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

  const totalMiles = legs.reduce((sum, l) => sum + l.miles, 0);
  const hasApprox = legs.some((l) => l.approx);

  const formatMiles = (m: number) =>
    m >= 100 ? Math.round(m).toLocaleString() : m.toFixed(m >= 10 ? 0 : 1);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-600">
          Route
        </h3>
        {legs.length > 0 && (
          <span className="text-xs text-slate-400">
            {stops.length} {stops.length === 1 ? 'place' : 'places'} ·{' '}
            {hasApprox ? '~' : ''}{formatMiles(totalMiles)} mi
          </span>
        )}
      </div>

      {/* Search-to-add — the only control */}
      <div ref={searchRef} className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Add a place you went…"
          className="pl-9"
          aria-label="Search for a place to add"
          disabled={adding}
        />
        {(searching || adding) && (
          <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-amber-500" />
        )}
        <AnimatePresence>
          {results.length > 0 && (
            <motion.ul
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="absolute z-20 mt-1.5 max-h-56 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-card-hover"
            >
              {results.map((r, i) => (
                <li key={`${r.lat}-${r.lon}-${i}`}>
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
          <AnimatePresence initial={false}>
            {stops.map((stop, i) => {
              const leg = legs.find((l) => l.toId === stop.id);
              const cfg = modeConfig(stop.travelMode);
              const LegIcon = cfg.icon;
              return (
                <motion.li
                  key={stop.id}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.18 }}
                >
                  {/* Leg chip: how you got here + distance */}
                  {i > 0 && (
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
                        {leg ? `${leg.approx ? '~' : ''}${formatMiles(leg.miles)} mi` : cfg.label}
                      </button>
                      {modePickerFor === stop.id && (
                        <div
                          className="absolute left-8 top-7 z-30 flex gap-0.5 rounded-lg border border-slate-200 bg-white p-1 shadow-card-hover"
                          onMouseDown={(e) => e.stopPropagation()}
                        >
                          {MODES.map((m) => {
                            const MIcon = m.icon;
                            const active = (stop.travelMode ?? 'drive') === m.key;
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
                      onClick={() => removeStop(stop.id)}
                      aria-label={`Remove ${stop.name}`}
                      className="flex size-6 shrink-0 items-center justify-center rounded-md text-slate-300 transition-colors hover:bg-red-50 hover:text-red-500 active:bg-red-50 active:text-red-500 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}
