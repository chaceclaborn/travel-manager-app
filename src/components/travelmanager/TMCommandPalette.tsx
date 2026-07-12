'use client';
import { detailHref } from '@/lib/travelmanager/detail-routes';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Search,
  MapPin,
  Building2,
  Users,
  X,
  Clock,
  Plane,
  CalendarDays,
  Loader2,
  Plus,
  LayoutDashboard,
  BarChart3,
  Map,
  Settings,
  Zap,
} from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

type EntityType = 'trip' | 'booking' | 'meeting' | 'vendor' | 'client' | 'itinerary';

interface SearchResults {
  trips: Array<{ id: string; title: string; destination: string | null }>;
  bookings: Array<{ id: string; provider: string; type: string; location: string | null }>;
  meetings: Array<{ id: string; title: string; location: string | null; startDateTime: string }>;
  vendors: Array<{ id: string; name: string; category: string; contactName: string | null }>;
  clients: Array<{ id: string; name: string; company: string | null; email: string | null }>;
  itinerary: Array<{
    id: string;
    title: string;
    location: string | null;
    tripId: string;
    trip: { title: string };
  }>;
}

interface ResultItem {
  type: EntityType;
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

// Quick actions: creation shortcuts + page jumps, filtered by label/keyword
// substring match. All hrefs must be static routes (iOS bundle has no [id]
// routes — the route-firewall tests enforce this for entity results, and
// commands must follow the same rule).
interface Command {
  id: string;
  label: string;
  keywords: string;
  href: string;
  icon: typeof MapPin;
  create?: boolean;
}

const COMMANDS: Command[] = [
  { id: 'new-trip', label: 'New Trip', keywords: 'create add trip', href: '/trips/new', icon: Plus, create: true },
  { id: 'new-client', label: 'New Client', keywords: 'create add client', href: '/clients/new', icon: Plus, create: true },
  { id: 'new-vendor', label: 'New Vendor', keywords: 'create add vendor supplier', href: '/vendors/new', icon: Plus, create: true },
  { id: 'go-dashboard', label: 'Go to Dashboard', keywords: 'home overview', href: '/', icon: LayoutDashboard },
  { id: 'go-trips', label: 'Go to Trips', keywords: 'trips travel', href: '/trips', icon: MapPin },
  { id: 'go-clients', label: 'Go to Clients', keywords: 'clients people', href: '/clients', icon: Users },
  { id: 'go-vendors', label: 'Go to Vendors', keywords: 'vendors suppliers', href: '/vendors', icon: Building2 },
  { id: 'go-bookings', label: 'Go to Bookings', keywords: 'bookings flights hotels reservations new booking', href: '/bookings', icon: Plane },
  { id: 'go-meetings', label: 'Go to Meetings', keywords: 'meetings calendar appointments new meeting', href: '/meetings', icon: CalendarDays },
  { id: 'go-analytics', label: 'Go to Analytics', keywords: 'analytics stats charts reports', href: '/analytics', icon: BarChart3 },
  { id: 'go-map', label: 'Go to Map', keywords: 'map travel world', href: '/map', icon: Map },
  { id: 'go-settings', label: 'Go to Settings', keywords: 'settings preferences account', href: '/settings', icon: Settings },
];

function matchCommands(query: string): Command[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return COMMANDS.filter(
    (c) => c.label.toLowerCase().includes(q) || c.keywords.includes(q)
  ).slice(0, 5);
}

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

  for (const t of results.trips) {
    items.push({
      type: 'trip',
      id: t.id,
      label: t.title,
      sublabel: t.destination,
      href: detailHref('trips', t.id),
    });
  }
  for (const b of results.bookings) {
    items.push({
      type: 'booking',
      id: b.id,
      label: b.provider,
      sublabel: b.location ?? b.type,
      href: detailHref('bookings', b.id),
    });
  }
  for (const m of results.meetings) {
    items.push({
      type: 'meeting',
      id: m.id,
      label: m.title,
      sublabel: m.location,
      href: `/meetings`,
    });
  }
  for (const v of results.vendors) {
    items.push({
      type: 'vendor',
      id: v.id,
      label: v.name,
      sublabel: v.contactName ?? v.category,
      href: detailHref('vendors', v.id),
    });
  }
  for (const c of results.clients) {
    items.push({
      type: 'client',
      id: c.id,
      label: c.name,
      sublabel: c.company ?? c.email,
      href: detailHref('clients', c.id),
    });
  }
  for (const i of results.itinerary) {
    items.push({
      type: 'itinerary',
      id: i.id,
      label: i.title,
      sublabel: i.location ?? i.trip.title,
      href: detailHref('trips', i.tripId),
    });
  }
  return items;
}

const sectionIcons: Record<EntityType, typeof MapPin> = {
  trip: MapPin,
  booking: Plane,
  meeting: Users,
  vendor: Building2,
  client: Users,
  itinerary: CalendarDays,
};

const sectionLabels: Record<EntityType, string> = {
  trip: 'Trips',
  booking: 'Bookings',
  meeting: 'Meetings',
  vendor: 'Vendors',
  client: 'Clients',
  itinerary: 'Itinerary',
};

function hasAnyResults(r: SearchResults | null): boolean {
  if (!r) return false;
  return (
    r.trips.length > 0 ||
    r.bookings.length > 0 ||
    r.meetings.length > 0 ||
    r.vendors.length > 0 ||
    r.clients.length > 0 ||
    r.itinerary.length > 0
  );
}

export function TMCommandPalette({ open, onClose }: TMCommandPaletteProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const flatItems = useMemo(
    () => (results ? flattenResults(results) : []),
    [results]
  );

  // Commands match synchronously (no debounce): with an empty query show the
  // create shortcuts; once typing, substring-match the full command list.
  // Keyboard navigation spans commands first, then entity results.
  const visibleCommands = useMemo(
    () => (query.trim().length < 2 ? COMMANDS.filter((c) => c.create) : matchCommands(query)),
    [query]
  );
  const totalNavItems = visibleCommands.length + flatItems.length;

  // Reset state when opening — adjusted during render (React's "adjusting
  // state when props change" pattern) so no effect-triggered re-render.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setQuery('');
      setResults(null);
      setActiveIndex(0);
      setRecentSearches(getRecentSearches());
    }
  }

  // Focus the input when opening (DOM side effect stays in an effect)
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Loading/reset state tracks query transitions — adjusted during render so
  // the effect below only owns the actual network request.
  const [prevQuery, setPrevQuery] = useState(query);
  if (query !== prevQuery) {
    setPrevQuery(query);
    setActiveIndex(0);
    if (query.trim().length < 2) {
      setResults(null);
      setLoading(false);
    } else {
      setLoading(true);
    }
  }

  // Debounced search with AbortController — cancels stale requests
  useEffect(() => {
    const q = query.trim();

    if (q.length < 2) return;

    const controller = new AbortController();

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        if (res.ok) {
          const data: SearchResults = await res.json();
          if (!controller.signal.aborted) {
            setResults(data);
            setActiveIndex(0);
            setLoading(false);
          }
        } else if (!controller.signal.aborted) {
          setLoading(false);
        }
      } catch (err) {
        // AbortError is expected on cancellation — ignore silently
        if ((err as Error).name !== 'AbortError' && !controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

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
      if (totalNavItems === 0) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % totalNavItems);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + totalNavItems) % totalNavItems);
      } else if (e.key === 'Enter') {
        const target =
          activeIndex < visibleCommands.length
            ? visibleCommands[activeIndex]
            : flatItems[activeIndex - visibleCommands.length];
        if (target) {
          e.preventDefault();
          navigateTo(target.href);
        }
      }
    },
    [totalNavItems, visibleCommands, flatItems, activeIndex, navigateTo]
  );

  const showRecent = query.length < 2 && recentSearches.length > 0;
  const showEmptyState =
    !loading &&
    query.trim().length >= 2 &&
    results !== null &&
    !hasAnyResults(results) &&
    visibleCommands.length === 0;

  // Pre-compute which items begin a new section, so render stays pure
  // (no `let` reassignment during the .map() callback).
  const sectionFlags = useMemo(() => {
    const flags: boolean[] = [];
    let prev: EntityType | null = null;
    for (const item of flatItems) {
      flags.push(item.type !== prev);
      prev = item.type;
    }
    return flags;
  }, [flatItems]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        aria-label="Search"
        showCloseButton={false}
        onKeyDown={handleKeyDown}
        className="top-[15vh] left-[50%] translate-x-[-50%] translate-y-0 w-full max-w-lg gap-0 rounded-xl border-0 bg-white p-0 shadow-2xl sm:max-w-lg"
      >
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
          <Search className="size-5 shrink-0 text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search trips, bookings, meetings, vendors, clients..."
            aria-label="Search all entities"
            className="flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 outline-none"
          />
          {loading && <Loader2 className="size-4 shrink-0 animate-spin text-slate-400" />}
          {query && !loading && (
            <button
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        <div className="max-h-96 overflow-y-auto p-2">
          {showEmptyState && (
            <div className="px-3 py-6 text-center text-sm text-slate-400">
              No results for &quot;{query.trim()}&quot;
            </div>
          )}

          {visibleCommands.length > 0 && (
            <div>
              <div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold uppercase text-slate-400">
                <Zap className="size-3.5" />
                {query.trim().length < 2 ? 'Quick Actions' : 'Commands'}
              </div>
              {visibleCommands.map((cmd, index) => {
                const CmdIcon = cmd.icon;
                return (
                  <Link
                    key={cmd.id}
                    href={cmd.href}
                    onClick={(e) => {
                      e.preventDefault();
                      navigateTo(cmd.href);
                    }}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                      index === activeIndex
                        ? 'bg-amber-50 text-amber-900'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <CmdIcon className="size-4 shrink-0 text-slate-400" />
                    <span className="flex-1 truncate font-medium">{cmd.label}</span>
                  </Link>
                );
              })}
            </div>
          )}

          {showRecent && (
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

          {flatItems.map((item, index) => {
            const showHeader = sectionFlags[index];
            const Icon = sectionIcons[item.type];

            return (
              <div key={`${item.type}-${item.id}`}>
                {showHeader && (
                  <div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold uppercase text-slate-400">
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
                    index + visibleCommands.length === activeIndex
                      ? 'bg-amber-50 text-amber-900'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="size-4 shrink-0 text-slate-400" />
                  <span className="flex-1 truncate font-medium">{item.label}</span>
                  {item.sublabel && (
                    <span className="truncate text-xs text-slate-400">{item.sublabel}</span>
                  )}
                </Link>
              </div>
            );
          })}
        </div>

        <div className="border-t border-slate-200 px-4 py-2 text-xs text-slate-400">
          <span className="mr-3">
            <kbd className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px]">↑↓</kbd> navigate
          </span>
          <span className="mr-3">
            <kbd className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px]">↵</kbd> open
          </span>
          <span>
            <kbd className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px]">esc</kbd> close
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
