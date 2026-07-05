'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  LayoutDashboard,
  MapPin,
  Building2,
  Users,
  BarChart3,
  Globe,
  Plane,
} from 'lucide-react';

export interface NavItemDef {
  /** Stable identifier used to persist visibility — NEVER change these. */
  key: string;
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  shortcut: string;
  track: string;
  /** Whether the user is allowed to hide this item from the sidebar. */
  toggleable: boolean;
  /** One-liner shown next to the toggle in Settings. */
  description?: string;
}

// Single source of truth for the main sidebar navigation. Both TMSidebar and
// the Settings customization card render from this list, so they can never
// drift out of sync. Dashboard is intentionally NOT toggleable — it's the
// home anchor and hiding it would strand the user.
export const NAV_ITEMS: NavItemDef[] = [
  { key: 'dashboard', href: '/', label: 'Dashboard', icon: LayoutDashboard, shortcut: 'G D', track: 'nav:dashboard', toggleable: false, description: 'Your home overview (always shown)' },
  { key: 'trips', href: '/trips', label: 'Trips', icon: MapPin, shortcut: 'G T', track: 'nav:trips', toggleable: true, description: 'Plan and track your trips' },
  { key: 'bookings', href: '/bookings', label: 'Bookings', icon: Plane, shortcut: 'G B', track: 'nav:bookings', toggleable: true, description: 'Flights, hotels, and reservations' },
  { key: 'meetings', href: '/meetings', label: 'Meetings', icon: Users, shortcut: 'G E', track: 'nav:meetings', toggleable: true, description: 'Scheduled meetings' },
  { key: 'vendors', href: '/vendors', label: 'Vendors', icon: Building2, shortcut: 'G V', track: 'nav:vendors', toggleable: true, description: 'Suppliers and service providers' },
  { key: 'clients', href: '/clients', label: 'Clients', icon: Users, shortcut: 'G C', track: 'nav:clients', toggleable: true, description: 'People and companies you travel for' },
  { key: 'analytics', href: '/analytics', label: 'Analytics', icon: BarChart3, shortcut: 'G A', track: 'nav:analytics', toggleable: true, description: 'Spending and travel insights' },
  { key: 'map', href: '/map', label: 'Map', icon: Globe, shortcut: 'G M', track: 'nav:map', toggleable: true, description: 'Global map of every place you\'ve been' },
];

export const TOGGLEABLE_NAV_ITEMS = NAV_ITEMS.filter((i) => i.toggleable);

const STORAGE_KEY = 'tm-hidden-nav';
// Fired on the window whenever prefs change in THIS tab, so every mounted
// consumer (sidebar + settings) updates live without a reload. Cross-tab
// updates come through the native `storage` event instead.
const CHANGE_EVENT = 'tm-nav-prefs-changed';

/**
 * Reduce an arbitrary parsed value to the set of keys we're willing to hide.
 * Only honors keys that exist and are actually toggleable — this drops stale
 * keys from removed features, ignores malformed input, and can NEVER hide a
 * non-toggleable item like Dashboard. Pure + exported so it can be unit-tested
 * without a DOM.
 */
export function sanitizeHiddenKeys(parsed: unknown): Set<string> {
  if (!Array.isArray(parsed)) return new Set();
  const allowed = new Set(TOGGLEABLE_NAV_ITEMS.map((i) => i.key));
  return new Set(parsed.filter((k): k is string => typeof k === 'string' && allowed.has(k)));
}

function readHidden(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    return sanitizeHiddenKeys(JSON.parse(raw));
  } catch {
    return new Set();
  }
}

function writeHidden(hidden: Set<string>) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...hidden]));
  } catch {
    // Storage full / disabled (e.g. private mode) — fail silently; the UI
    // still reflects the change for this session via the event below.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/**
 * Sidebar visibility preferences, backed by localStorage (per-device, no
 * server round-trip). `hydrated` is false until the first client effect runs;
 * render everything visible until then to avoid an SSR hydration mismatch.
 */
export function useNavPreferences() {
  const [hidden, setHiddenState] = useState<Set<string>>(() => new Set());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // One-time client hydration from localStorage.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration, not a render cascade
    setHiddenState(readHidden());
    setHydrated(true);

    const sync = () => setHiddenState(readHidden());
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) sync();
    };
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const isHidden = useCallback((key: string) => hidden.has(key), [hidden]);

  const setHidden = useCallback((key: string, hide: boolean) => {
    const item = TOGGLEABLE_NAV_ITEMS.find((i) => i.key === key);
    if (!item) return; // never allow hiding a non-toggleable item
    const next = readHidden();
    if (hide) next.add(key);
    else next.delete(key);
    writeHidden(next);
    setHiddenState(next);
  }, []);

  const reset = useCallback(() => {
    writeHidden(new Set());
    setHiddenState(new Set());
  }, []);

  // Items to actually render in the sidebar. Before hydration we show all
  // (server-safe default); after, we drop hidden ones.
  const visibleItems = hydrated ? NAV_ITEMS.filter((i) => !hidden.has(i.key)) : NAV_ITEMS;

  return { hidden, isHidden, setHidden, reset, hydrated, visibleItems };
}
