'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  checkPushPermission,
  requestPushPermission,
  type PushPermission,
} from '@/lib/push';
import { isNativePlatform, apiFetch } from '@/lib/mobile-auth';

/**
 * Single source of truth for the push-notification opt-in flow, shared by the
 * priming card, the Settings toggle, and PushRegister.
 *
 * Two independent pieces of state:
 *   - `permission`  — the OS-level state (only the OS can change it; we can only
 *                     ask). Checked without prompting.
 *   - `optIn`       — the user's in-app choice, persisted per-device in
 *                     localStorage: 'enabled' (wants reminders), 'dismissed'
 *                     (said not now / turned off), or 'unset' (never asked).
 *
 * A push is only ever delivered when optIn==='enabled' AND permission==='granted'.
 * A window event keeps every mounted consumer (card + settings + PushRegister)
 * in sync within the tab without a reload.
 */

export type PushOptIn = 'enabled' | 'dismissed' | 'unset';

const OPTIN_KEY = 'tm-push-optin';
/** The last APNs token we registered, so disable() can delete precisely. */
export const PUSH_TOKEN_KEY = 'tm-push-token';
const CHANGE_EVENT = 'tm-push-prefs-changed';

function readOptIn(): PushOptIn {
  if (typeof window === 'undefined') return 'unset';
  try {
    const v = window.localStorage.getItem(OPTIN_KEY);
    return v === 'enabled' || v === 'dismissed' ? v : 'unset';
  } catch {
    return 'unset';
  }
}

function writeOptIn(value: PushOptIn) {
  try {
    if (value === 'unset') window.localStorage.removeItem(OPTIN_KEY);
    else window.localStorage.setItem(OPTIN_KEY, value);
  } catch {
    /* storage disabled (private mode) — session-only, still fine */
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export interface UsePushNotifications {
  /** Push is only supported natively for now. */
  supported: boolean;
  permission: PushPermission | 'unknown';
  optIn: PushOptIn;
  busy: boolean;
  hydrated: boolean;
  /** Prompt for permission and, if granted, mark opted-in. Returns the outcome. */
  enable: () => Promise<'granted' | 'denied' | 'unsupported'>;
  /** Turn reminders off: delete this device's token and mark dismissed. */
  disable: () => Promise<void>;
  /** "Not now" — dismiss the priming card without prompting. */
  dismiss: () => void;
}

export function usePushNotifications(): UsePushNotifications {
  const supported = isNativePlatform();
  const [permission, setPermission] = useState<PushPermission | 'unknown'>('unknown');
  const [optIn, setOptIn] = useState<PushOptIn>('unset');
  const [busy, setBusy] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const sync = async () => {
      let nextOptIn = readOptIn();
      const nextPerm = await checkPushPermission();
      if (cancelled) return;
      // Migration for users who granted OS permission under the old
      // auto-prompt-on-launch build: they never saw the opt-in UI, so their
      // stored choice is 'unset' while their device token is already
      // registered server-side. Treat granted+unset as enabled — it matches
      // what they agreed to, keeps their token fresh, and makes the Settings
      // toggle reflect reality. Native only (a stray web Notification grant
      // must not flip the toggle).
      if (supported && nextPerm === 'granted' && nextOptIn === 'unset') {
        writeOptIn('enabled');
        nextOptIn = 'enabled';
      }
      setOptIn(nextOptIn);
      setPermission(nextPerm);
      setHydrated(true);
    };

    sync();
    const onChange = () => { void sync(); };
    window.addEventListener(CHANGE_EVENT, onChange);
    window.addEventListener('focus', onChange);
    return () => {
      cancelled = true;
      window.removeEventListener(CHANGE_EVENT, onChange);
      window.removeEventListener('focus', onChange);
    };
  }, [supported]);

  const enable = useCallback(async (): Promise<'granted' | 'denied' | 'unsupported'> => {
    setBusy(true);
    try {
      const granted = await requestPushPermission();
      const perm = await checkPushPermission();
      setPermission(perm);
      if (granted) {
        // Broadcasts CHANGE_EVENT → PushRegister picks it up and registers the
        // device token + listeners exactly once.
        writeOptIn('enabled');
        setOptIn('enabled');
        return 'granted';
      }
      return perm === 'unsupported' ? 'unsupported' : 'denied';
    } finally {
      setBusy(false);
    }
  }, []);

  const disable = useCallback(async (): Promise<void> => {
    setBusy(true);
    try {
      let token: string | null = null;
      try {
        token = window.localStorage.getItem(PUSH_TOKEN_KEY);
      } catch {
        /* ignore */
      }
      // Remove this device's token server-side so no further pushes are sent.
      // If we don't know the token, clear all of this user's tokens.
      await apiFetch('/api/push/register', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(token ? { token } : {}),
      }).catch(() => {});
      try {
        window.localStorage.removeItem(PUSH_TOKEN_KEY);
      } catch {
        /* ignore */
      }
      writeOptIn('dismissed');
      setOptIn('dismissed');
    } finally {
      setBusy(false);
    }
  }, []);

  const dismiss = useCallback((): void => {
    writeOptIn('dismissed');
    setOptIn('dismissed');
  }, []);

  return { supported, permission, optIn, busy, hydrated, enable, disable, dismiss };
}
