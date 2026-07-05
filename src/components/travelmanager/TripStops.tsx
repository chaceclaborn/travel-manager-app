'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Search, X, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';

export interface TripStopData {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  date: string | null;
  notes: string | null;
  sortOrder: number;
}

interface GeocodeResult {
  display_name: string;
  lat: string;
  lon: string;
}

interface TripStopsProps {
  tripId: string;
  onStopsChange?: (stops: TripStopData[]) => void;
}

/**
 * Places visited within a trip — the stops beyond the single top-level
 * destination (fly to El Paso, then drive to Marfa, White Sands, …).
 * One search input, no extra buttons: pick a suggestion to add it.
 */
export function TripStops({ tripId, onStopsChange }: TripStopsProps) {
  const [stops, setStops] = useState<TripStopData[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const notify = useCallback(
    (next: TripStopData[]) => {
      setStops(next);
      onStopsChange?.(next);
    },
    [onStopsChange]
  );

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/trips/${tripId}/stops`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (!cancelled) notify(Array.isArray(data) ? data : []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tripId, notify]);

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

  // Close suggestions on outside click
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setResults([]);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const addStop = async (r: GeocodeResult) => {
    setAdding(true);
    setResults([]);
    setQuery('');
    try {
      // First segment of the display name is the place itself
      const name = r.display_name.split(',').slice(0, 2).join(',').trim();
      const res = await fetch(`/api/trips/${tripId}/stops`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, latitude: Number(r.lat), longitude: Number(r.lon) }),
      });
      if (res.ok) {
        const stop = await res.json();
        notify([...stops, stop]);
      }
    } catch {
      // request failed — list simply stays as-is
    } finally {
      setAdding(false);
    }
  };

  const removeStop = async (stopId: string) => {
    const prev = stops;
    notify(stops.filter((s) => s.id !== stopId));
    try {
      const res = await fetch(`/api/trips/${tripId}/stops/${stopId}`, { method: 'DELETE' });
      if (!res.ok) notify(prev);
    } catch {
      notify(prev);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-600">
          Places
        </h3>
        {stops.length > 0 && (
          <span className="text-xs text-slate-400">
            {stops.length} {stops.length === 1 ? 'stop' : 'stops'}
          </span>
        )}
      </div>

      {/* Search-to-add — the only control */}
      <div ref={containerRef} className="relative">
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
                    onClick={() => addStop(r)}
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

      {/* Stop list */}
      {loading ? (
        <div className="mt-3 space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-9 animate-pulse rounded-lg bg-slate-100" />
          ))}
        </div>
      ) : stops.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400">
          No places yet — add the spots you visited on this trip.
        </p>
      ) : (
        <ul className="mt-3 space-y-1">
          <AnimatePresence initial={false}>
            {stops.map((stop, i) => (
              <motion.li
                key={stop.id}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.18 }}
                className="group"
              >
                <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-slate-50">
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
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}
