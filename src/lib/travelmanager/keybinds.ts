'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Customizable keyboard shortcuts, backed by localStorage (per-device, same
 * pattern as useNavPreferences). Two kinds of bindings:
 *   - 'mod'   → ⌘/Ctrl + <letter>  (the search palette)
 *   - 'chord' → G then <letter>    (page navigation)
 * Customization is the letter only — the modifier/prefix stays fixed, which
 * keeps the capture UI simple and avoids conflicts with browser shortcuts.
 */

export type KeybindKind = 'mod' | 'chord';

export interface KeybindDef {
  /** Stable identifier used to persist overrides — NEVER change these. */
  action: string;
  label: string;
  kind: KeybindKind;
  defaultKey: string;
  /** Navigation target for chord bindings (handled in the app layout). */
  href?: string;
}

export const KEYBIND_DEFS: KeybindDef[] = [
  { action: 'search', label: 'Open search / command palette', kind: 'mod', defaultKey: 'k' },
  { action: 'go-dashboard', label: 'Go to Dashboard', kind: 'chord', defaultKey: 'd', href: '/' },
  { action: 'go-trips', label: 'Go to Trips', kind: 'chord', defaultKey: 't', href: '/trips' },
  { action: 'go-bookings', label: 'Go to Bookings', kind: 'chord', defaultKey: 'b', href: '/bookings' },
  { action: 'go-meetings', label: 'Go to Meetings', kind: 'chord', defaultKey: 'e', href: '/meetings' },
  { action: 'go-vendors', label: 'Go to Vendors', kind: 'chord', defaultKey: 'v', href: '/vendors' },
  { action: 'go-clients', label: 'Go to Clients', kind: 'chord', defaultKey: 'c', href: '/clients' },
  { action: 'go-friends', label: 'Go to Friends', kind: 'chord', defaultKey: 'f', href: '/friends' },
  { action: 'go-analytics', label: 'Go to Analytics', kind: 'chord', defaultKey: 'a', href: '/analytics' },
  { action: 'go-map', label: 'Go to Map', kind: 'chord', defaultKey: 'm', href: '/map' },
  { action: 'go-settings', label: 'Go to Settings', kind: 'chord', defaultKey: 's', href: '/settings' },
  { action: 'go-admin', label: 'Go to Admin', kind: 'chord', defaultKey: 'x', href: '/admin' },
];

const DEFAULTS: Record<string, string> = Object.fromEntries(
  KEYBIND_DEFS.map((d) => [d.action, d.defaultKey])
);

const STORAGE_KEY = 'tm-keybinds';
const CHANGE_EVENT = 'tm-keybinds-changed';

const VALID_KEY = /^[a-z0-9]$/;

/**
 * Reduce arbitrary parsed storage to a safe overrides map: known actions,
 * single a-z/0-9 keys, and no duplicate keys within the same kind (first
 * writer wins; later conflicting entries fall back to their default).
 * Pure + exported for unit testing.
 */
export function sanitizeKeybinds(parsed: unknown): Record<string, string> {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
  const overrides: Record<string, string> = {};
  const usedByKind: Record<KeybindKind, Set<string>> = { mod: new Set(), chord: new Set() };

  // Seed used-keys with the effective key of every action so an override
  // can't collide with another action's default that isn't itself overridden.
  for (const def of KEYBIND_DEFS) {
    const raw = (parsed as Record<string, unknown>)[def.action];
    const key = typeof raw === 'string' ? raw.toLowerCase() : null;
    const valid = key !== null && VALID_KEY.test(key) ? key : null;
    const effective = valid ?? def.defaultKey;
    if (usedByKind[def.kind].has(effective)) continue; // conflict → keep default
    usedByKind[def.kind].add(effective);
    if (valid && valid !== def.defaultKey) overrides[def.action] = valid;
  }
  return overrides;
}

function readKeybinds(): Record<string, string> {
  if (typeof window === 'undefined') return { ...DEFAULTS };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const overrides = raw ? sanitizeKeybinds(JSON.parse(raw)) : {};
    return { ...DEFAULTS, ...overrides };
  } catch {
    return { ...DEFAULTS };
  }
}

function writeOverrides(binds: Record<string, string>) {
  if (typeof window === 'undefined') return;
  const overrides: Record<string, string> = {};
  for (const def of KEYBIND_DEFS) {
    if (binds[def.action] && binds[def.action] !== def.defaultKey) {
      overrides[def.action] = binds[def.action];
    }
  }
  try {
    if (Object.keys(overrides).length === 0) {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
    }
  } catch {
    // Storage full / disabled — the in-tab event below still updates the UI.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** The action (if any) that already uses `key` for the given kind. */
export function findConflict(
  binds: Record<string, string>,
  kind: KeybindKind,
  key: string,
  exceptAction: string
): KeybindDef | null {
  for (const def of KEYBIND_DEFS) {
    if (def.kind !== kind || def.action === exceptAction) continue;
    if (binds[def.action] === key) return def;
  }
  return null;
}

/** "g" + "t" → "G T"; mod binding renders via the platform key in the UI. */
export function chordLabel(key: string): string {
  return `G ${key.toUpperCase()}`;
}

export function useKeybinds() {
  const [binds, setBindsState] = useState<Record<string, string>>(() => ({ ...DEFAULTS }));
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // One-time client hydration from localStorage.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration, not a render cascade
    setBindsState(readKeybinds());
    setHydrated(true);

    const sync = () => setBindsState(readKeybinds());
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

  /** Returns null on success, or an error message when the key is invalid/taken. */
  const setBind = useCallback((action: string, rawKey: string): string | null => {
    const def = KEYBIND_DEFS.find((d) => d.action === action);
    if (!def) return 'Unknown shortcut';
    const key = rawKey.toLowerCase();
    if (!VALID_KEY.test(key)) return 'Use a letter or number';
    const current = readKeybinds();
    const conflict = findConflict(current, def.kind, key, action);
    if (conflict) return `Already used by "${conflict.label}"`;
    const next = { ...current, [action]: key };
    writeOverrides(next);
    setBindsState(next);
    return null;
  }, []);

  const reset = useCallback(() => {
    writeOverrides({ ...DEFAULTS });
    setBindsState({ ...DEFAULTS });
  }, []);

  return { binds, setBind, reset, hydrated };
}
