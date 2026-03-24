'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

export interface GeoResult {
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  address: Record<string, string>;
}

export function formatGeoName(result: GeoResult): string {
  const addr = result.address;
  const city = addr.city || addr.town || addr.village || addr.hamlet || '';
  const state = addr.state || '';
  const country = addr.country || '';
  return [city, state, country].filter(Boolean).join(', ') || result.display_name;
}

export function useGeocodingSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeoResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastFetchRef = useRef(0);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const search = useCallback(async (q: string) => {
    if (q.length < 3) {
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
      const res = await fetch(`/api/geocode/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data: GeoResult[] = await res.json();
        setResults(data);
        setIsOpen(data.length > 0);
      }
    } catch {
      // silent — user can still type freely
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleInputChange = useCallback((val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 400);
  }, [search]);

  const selectResult = useCallback((result: GeoResult) => {
    const name = formatGeoName(result);
    setQuery(name);
    setIsOpen(false);
    setResults([]);
    return { name, lat: parseFloat(result.lat), lng: parseFloat(result.lon) };
  }, []);

  const clear = useCallback(() => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
  }, []);

  return {
    query,
    setQuery,
    results,
    isOpen,
    setIsOpen,
    isSearching,
    containerRef,
    handleInputChange,
    selectResult,
    clear,
  };
}
