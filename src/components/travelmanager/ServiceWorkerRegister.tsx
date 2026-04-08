'use client';

/**
 * Registers `/sw.js` on mount in production builds only.
 *
 * Skipped in development because the dev server's hot reload + webpack HMR
 * clashes with a persistent service worker (you end up serving stale bundles
 * and chasing ghost bugs). Capacitor builds set NODE_ENV=production so the
 * native shell still gets the SW.
 *
 * Failures are logged but otherwise ignored — SW registration must NEVER
 * break the app shell.
 */

import { useEffect } from 'react';

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV === 'development') return;

    const register = async () => {
      try {
        await navigator.serviceWorker.register('/sw.js');
      } catch (err) {
        console.warn('SW registration failed', err);
      }
    };
    register();
  }, []);

  return null;
}
