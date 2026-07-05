'use client';

import { useCallback, useEffect, useState } from 'react';

// Whether monetary figures (trip budgets, expense amounts) are shown across
// trip surfaces. Stored per-device in localStorage — no DB, no server call.
// Defaults to SHOWN when unset, and the server always renders the shown state,
// so hydration matches (we only ever hide *after* the client effect runs).
const STORAGE_KEY = 'tm-show-costs';
const CHANGE_EVENT = 'tm-show-costs-changed';

/**
 * Interpret a raw stored value: only the literal '0' means hidden; anything
 * else — including null/unset or a legacy value — means shown. Pure + exported
 * for unit testing without a DOM. Defaulting to shown means the server and the
 * first client render always agree (costs visible), so there's no hydration
 * flash for the common case.
 */
export function isCostsShown(raw: string | null): boolean {
  return raw !== '0';
}

function readShowCosts(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return isCostsShown(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return true;
  }
}

function writeShowCosts(show: boolean) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, show ? '1' : '0');
  } catch {
    // Storage disabled (e.g. private mode) — the event below still updates
    // this session's mounted consumers.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/**
 * Read/write the "show costs" preference. `hydrated` is false until the first
 * client effect; render costs visible until then to avoid an SSR mismatch.
 * Stays in sync across every mounted consumer (and browser tabs) via events.
 */
export function useShowCosts() {
  const [showCosts, setShowCostsState] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time client hydration
    setShowCostsState(readShowCosts());
    setHydrated(true);

    const sync = () => setShowCostsState(readShowCosts());
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

  const setShowCosts = useCallback((show: boolean) => {
    writeShowCosts(show);
    setShowCostsState(show);
  }, []);

  return { showCosts, setShowCosts, hydrated };
}
