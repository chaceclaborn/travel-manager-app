'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
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
  const pathname = usePathname();

  // Record where the user actually is, so a rebuild can put them back on the
  // exact screen — not just the right tab. Capacitor Preferences writes to the
  // app container's plist, which is readable from outside the app:
  //
  //   C=$(xcrun simctl get_app_container <udid> com.chaceclaborn.travelmanager data)
  //   plutil -extract 'CapacitorStorage.tm-last-route' raw -o - \
  //     "$C/Library/Preferences/com.chaceclaborn.travelmanager.plist"
  //
  // Without this there is no way to know which trip was open, so "put it back
  // where I was" is guesswork.
  useEffect(() => {
    if (!isNativePlatform()) return;
    // Read the query straight off the location rather than useSearchParams():
    // that hook forces a Suspense boundary in a static export, and wrapping
    // this component in one stopped the effect running at all.
    const route = `${pathname}${window.location.search}`;
    (async () => {
      try {
        const { Preferences } = await import('@capacitor/preferences');
        await Preferences.set({ key: 'tm-last-route', value: route });
      } catch {
        // Recording the route is a dev convenience; never let it break nav.
      }
    })();
  }, [pathname]);

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
