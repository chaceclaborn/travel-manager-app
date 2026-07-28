'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  LayoutDashboard,
  MapPin,
  Building2,
  Users,
  HeartHandshake,
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
  { key: 'friends', href: '/friends', label: 'Friends', icon: HeartHandshake, shortcut: 'G F', track: 'nav:friends', toggleable: true, description: 'People you travel with' },
  { key: 'analytics', href: '/analytics', label: 'Analytics', icon: BarChart3, shortcut: 'G A', track: 'nav:analytics', toggleable: true, description: 'Spending and travel insights' },
  { key: 'map', href: '/map', label: 'Map', icon: Globe, shortcut: 'G M', track: 'nav:map', toggleable: true, description: 'Global map of every place you\'ve been' },
];

export const TOGGLEABLE_NAV_ITEMS = NAV_ITEMS.filter((i) => i.toggleable);

const STORAGE_KEY = 'tm-hidden-nav';
const TABS_KEY = 'tm-mobile-tabs';

/**
 * The mobile tab bar has five slots. Home and More are fixed — Home is the
 * anchor and More is the escape hatch to everything else — leaving three the
 * user can choose. Anything not chosen is still reachable under More, so this
 * only ever changes what's one tap away, never what exists.
 */
export const MOBILE_TAB_SLOTS = 3;

/** Everything eligible for a tab slot: the nav minus the fixed Dashboard. */
export const TABBABLE_NAV_ITEMS = NAV_ITEMS.filter((i) => i.key !== 'dashboard');

const DEFAULT_TAB_KEYS = ['trips', 'bookings', 'clients'];

/**
 * Reduce arbitrary stored input to a usable tab set: known keys only, no
 * duplicates, never more than the available slots. Falls back to the default
 * when the stored value is empty or unusable, so the bar can't end up blank.
 * Pure + exported for unit testing.
 */
export function sanitizeTabKeys(parsed: unknown): string[] {
  const allowed = new Set(TABBABLE_NAV_ITEMS.map((i) => i.key));
  if (!Array.isArray(parsed)) return DEFAULT_TAB_KEYS;
  const seen = new Set<string>();
  const keys = parsed.filter((k): k is string => {
    if (typeof k !== 'string' || !allowed.has(k) || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return keys.length > 0 ? keys.slice(0, MOBILE_TAB_SLOTS) : DEFAULT_TAB_KEYS;
}

function readTabKeys(): string[] {
  if (typeof window === 'undefined') return DEFAULT_TAB_KEYS;
  try {
    const raw = window.localStorage.getItem(TABS_KEY);
    if (!raw) return DEFAULT_TAB_KEYS;
    return sanitizeTabKeys(JSON.parse(raw));
  } catch {
    return DEFAULT_TAB_KEYS;
  }
}

function writeTabKeys(keys: string[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(TABS_KEY, JSON.stringify(keys));
  } catch {
    // Storage unavailable — the event below still updates this session.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}
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
  const [tabKeys, setTabKeysState] = useState<string[]>(() => DEFAULT_TAB_KEYS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // One-time client hydration from localStorage.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration, not a render cascade
    setHiddenState(readHidden());
    setTabKeysState(readTabKeys());
    setHydrated(true);

    const sync = () => {
      setHiddenState(readHidden());
      setTabKeysState(readTabKeys());
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY || e.key === TABS_KEY) sync();
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

  /** Toggle a destination in or out of the mobile tab bar. */
  const setTabKey = useCallback((key: string, inTabs: boolean) => {
    if (!TABBABLE_NAV_ITEMS.some((i) => i.key === key)) return;
    const current = readTabKeys();
    let next: string[];
    if (inTabs) {
      if (current.includes(key)) return;
      // Full: drop the oldest choice so a tap always visibly does something,
      // rather than silently refusing.
      next = [...current, key].slice(-MOBILE_TAB_SLOTS);
    } else {
      next = current.filter((k) => k !== key);
      if (next.length === 0) return; // never leave the bar with no destinations
    }
    writeTabKeys(next);
    setTabKeysState(next);
  }, []);

  /** Replace the whole order at once — used by drag-to-reorder. */
  const setTabOrder = useCallback((keys: string[]) => {
    const next = sanitizeTabKeys(keys);
    writeTabKeys(next);
    setTabKeysState(next);
  }, []);

  const resetTabs = useCallback(() => {
    writeTabKeys(DEFAULT_TAB_KEYS);
    setTabKeysState(DEFAULT_TAB_KEYS);
  }, []);

  /** Resolved nav items for the three middle tab slots, in chosen order. */
  const tabItems = (hydrated ? tabKeys : DEFAULT_TAB_KEYS)
    .map((k) => TABBABLE_NAV_ITEMS.find((i) => i.key === k))
    .filter((i): i is NavItemDef => !!i);

  return {
    hidden, isHidden, setHidden, reset, hydrated, visibleItems,
    tabKeys, tabItems, setTabKey, setTabOrder, resetTabs,
  };
}
