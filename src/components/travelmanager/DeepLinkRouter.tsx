'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isNativePlatform } from '@/lib/mobile-auth';

/**
 * Routes `travelmanager://<path>` deep links to the in-app router.
 *
 * Native-only. Two uses:
 *  - letting an agent or script drive the app during review
 *    (`xcrun simctl openurl <udid> travelmanager://trips`), which is otherwise
 *    impossible — the Simulator window is frequently on another macOS Space
 *    where GUI automation cannot reach it;
 *  - a place for push notifications and share links to land on the right
 *    screen rather than always dumping the user on the dashboard.
 *
 * Paths are resolved against the static export's route set, so only routes
 * that exist in the mobile bundle will work — see detail-routes.ts for why
 * `/trips/<id>` must be `/trips/detail?id=`.
 */
export function DeepLinkRouter() {
  const router = useRouter();

  useEffect(() => {
    if (!isNativePlatform()) return;
    let remove: (() => void) | undefined;

    (async () => {
      const { App } = await import('@capacitor/app');
      const handle = await App.addListener('appUrlOpen', ({ url }) => {
        // travelmanager://trips        -> /trips
        // travelmanager://trips/detail?id=abc -> /trips/detail?id=abc
        const rest = url.replace(/^travelmanager:\/\//i, '');
        if (rest === url) return; // not our scheme (e.g. the Google callback)
        const path = `/${rest.replace(/^\/+/, '')}`;
        router.push(path);
      });
      remove = () => handle.remove();
    })();

    return () => remove?.();
  }, [router]);

  return null;
}
