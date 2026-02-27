'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, MapPin, Building2, Users, X, Clock } from 'lucide-react';

interface SearchResults {
  trips: Array<{ id: string; title: string; destination: string | null }>;
  vendors: Array<{ id: string; name: string; city: string | null }>;
  clients: Array<{ id: string; name: string; company: string | null }>;
}

interface ResultItem {
  type: 'trip' | 'vendor' | 'client';
  id: string;
  label: string;
  sublabel: string | null;
  href: string;
}

interface TMCommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

const RECENT_KEY = 'tm-recent-searches';
const MAX_RECENT = 5;

function getRecentSearches(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveRecentSearch(query: string) {
  const recent = getRecentSearches().filter((s) => s !== query);
  recent.unshift(query);
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
}

function flattenResults(results: SearchResults): ResultItem[] {
  const items: ResultItem[] = [];
  for (const trip of results.trips) {
    items.push({ type: 'trip', id: trip.id, label: trip.title, sublabel: trip.destination, href: `/trips/${trip.id}` });
  }
  for (const vendor of results.vendors) {
    items.push({ type: 'vendor', id: vendor.id, label: vendor.name, sublabel: vendor.city, href: `/vendors/${vendor.id}` });
  }
  for (const client of results.clients) {
    items.push({ type: 'client', id: client.id, label: client.name, sublabel: client.company, href: `/clients/${client.id}` });
  }
  return items;
}

const sectionIcons = { trip: MapPin, vendor: Building2, client: Users } as const;
const sectionLabels = { trip: 'Trips', vendor: 'Vendors', client: 'Clients' } as const;

export function TMCommandPalette({ open, onClose }: TMCommandPaletteProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const flatItems = results ? flattenResults(results) : [];

  useEffect(() => {
    if (open) {
      setQuery('');
      setResults(null);
      setActiveIndex(0);
      setRecentSearches(getRecentSearches());
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const fetchResults = useCallback(
    (() => {
      let timer: ReturnType<typeof setTimeout>;
      return (q: string) => {
        clearTimeout(timer);
        if (q.length < 2) {
          setResults(null);
          setLoading(false);
          return;
        }
        setLoading(true);
        timer = setTimeout(async () => {
          try {
            const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
            if (res.ok) {
              const data = await res.json();
              setResults(data);
              setActiveIndex(0);
            }
          } catch {
            // silently fail
          } finally {
            setLoading(false);
          }
        }, 300);
      };
    })(),
    []
  );

  useEffect(() => {
    fetchResults(query);
  }, [query, fetchResults]);

  const navigateTo = useCallback(
    (href: string) => {
      if (query.trim().length >= 2) saveRecentSearch(query.trim());
      onClose();
      router.push(href);
    },
    [query, onClose, router]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % Math.max(flatItems.length, 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + flatItems.length) % Math.max(flatItems.length, 1));
      } else if (e.key === 'Enter' && flatItems[activeIndex]) {
        e.preventDefault();
        navigateTo(flatItems[activeIndex].href);
      }
    },
    [flatItems, activeIndex, navigateTo, onClose]
  );

  let currentSection: string | null = null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <motion.div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            className="relative w-full max-w-lg rounded-xl bg-white shadow-2xl"
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.15 }}
            onKeyDown={handleKeyDown}
          >
            <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
              <Search className="size-5 text-slate-400" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search trips, vendors, clients..."
                className="flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 outline-none"
              />
              {query && (
                <button onClick={() => setQuery('')} className="text-slate-400 hover:text-slate-600">
                  <X className="size-4" />
                </button>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto p-2">
              {loading && (
                <div className="px-3 py-6 text-center text-sm text-slate-400">Searching...</div>
              )}

              {!loading && query.length >= 2 && results && flatItems.length === 0 && (
                <div className="px-3 py-6 text-center text-sm text-slate-400">No results found</div>
              )}

              {!loading && query.length < 2 && recentSearches.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 px-3 py-2 text-xs font-medium uppercase text-slate-400">
                    <Clock className="size-3.5" />
                    Recent Searches
                  </div>
                  {recentSearches.map((term) => (
                    <button
                      key={term}
                      onClick={() => setQuery(term)}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-100"
                    >
                      <Search className="size-4 text-slate-400" />
                      {term}
                    </button>
                  ))}
                </div>
              )}

              {!loading &&
                flatItems.map((item, index) => {
                  const showHeader = item.type !== currentSection;
                  if (showHeader) currentSection = item.type;
                  const Icon = sectionIcons[item.type];

                  return (
                    <div key={`${item.type}-${item.id}`}>
                      {showHeader && (
                        <div className="flex items-center gap-2 px-3 py-2 text-xs font-medium uppercase text-slate-400">
                          <Icon className="size-3.5" />
                          {sectionLabels[item.type]}
                        </div>
                      )}
                      <Link
                        href={item.href}
                        onClick={(e) => {
                          e.preventDefault();
                          navigateTo(item.href);
                        }}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                          index === activeIndex
                            ? 'bg-amber-50 text-amber-900'
                            : 'text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <span className="flex-1 truncate">{item.label}</span>
                        {item.sublabel && (
                          <span className="truncate text-xs text-slate-400">{item.sublabel}</span>
                        )}
                      </Link>
                    </div>
                  );
                })}
            </div>

            <div className="border-t border-slate-200 px-4 py-2 text-xs text-slate-400">
              <span className="mr-3"><kbd className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px]">↑↓</kbd> navigate</span>
              <span className="mr-3"><kbd className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px]">↵</kbd> open</span>
              <span><kbd className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px]">esc</kbd> close</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
