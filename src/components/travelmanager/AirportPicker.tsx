'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Plane, Loader2, X } from 'lucide-react';

interface AirportPickerProps {
  value: string;
  displayValue: string;
  onChange: (airport: { code: string; name: string; lat: number; lng: number } | null) => void;
  label: string;
  error?: string;
  required?: boolean;
}

interface AirportResult {
  iata: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
}

export function AirportPicker({ value, displayValue, onChange, label, error, required }: AirportPickerProps) {
  const [query, setQuery] = useState(displayValue);
  const [results, setResults] = useState<AirportResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastFetchRef = useRef(0);

  useEffect(() => {
    setQuery(displayValue);
  }, [displayValue]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchAirports = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    const now = Date.now();
    const elapsed = now - lastFetchRef.current;
    if (elapsed < 1000) {
      await new Promise(resolve => setTimeout(resolve, 1000 - elapsed));
    }

    setIsSearching(true);
    try {
      lastFetchRef.current = Date.now();
      const res = await fetch(`/api/airports/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data: AirportResult[] = await res.json();
        setResults(data);
        setIsOpen(data.length > 0);
      }
    } catch {
      // Silently fail
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchAirports(val), 400);
  };

  const handleSelect = (airport: AirportResult) => {
    const display = `${airport.iata} — ${airport.name}`;
    setQuery(display);
    onChange({ code: airport.iata, name: airport.name, lat: airport.lat, lng: airport.lng });
    setIsOpen(false);
    setResults([]);
  };

  const handleClear = () => {
    setQuery('');
    onChange(null);
    setResults([]);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <label className="text-sm font-medium leading-none">{label}</label>
      <div className="relative mt-1.5">
        <Input
          value={query}
          onChange={handleInputChange}
          onFocus={() => { if (results.length > 0) setIsOpen(true); }}
          placeholder="Search airports..."
          aria-invalid={!!error}
          className={`pr-14 ${error ? 'border-red-500' : ''}`}
          autoComplete="off"
          required={required}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="text-slate-400 hover:text-slate-600 p-0.5"
            >
              <X className="size-3.5" />
            </button>
          )}
          {isSearching ? (
            <Loader2 className="size-4 animate-spin text-slate-400" />
          ) : (
            <Plane className="size-4 text-slate-400" />
          )}
        </div>
      </div>
      {isOpen && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-[200px] overflow-y-auto">
          {results.map((airport, idx) => (
            <button
              key={`${airport.iata}-${idx}`}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 border-b border-slate-100 last:border-b-0 flex items-start gap-2"
              onClick={() => handleSelect(airport)}
            >
              <Plane className="size-3.5 text-amber-500 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <div className="font-medium text-slate-800 truncate">
                  {airport.iata} — {airport.name}
                </div>
                <div className="text-xs text-slate-400 truncate">
                  {airport.city}, {airport.country}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
