import { isNativePlatform } from '@/lib/mobile-auth';
import { normalizeDeepLinkFor } from './detail-routes';

/**
 * Inbound deep-link handling for the native shell.
 *
 * Two URL shapes reach the app:
 *   travelmanager://trips                    — custom scheme. Used to drive the
 *                                              Simulator during review and as a
 *                                              landing target for pushes.
 *   https://www.travels-manager.com/trips/x  — a Universal Link: a shared trip
 *                                              tapped in Messages, Mail or Slack.
 *
 * The https shape used to be dropped on the floor, so even with the
 * associated-domains entitlement in place a shared link would open the app and
 * then strand the user on the dashboard.
 *
 * Split from DeepLinkRouter.tsx so the routing rules are unit-testable without
 * pulling in React and next/navigation — same pure-core/platform-wrapper split
 * as detailHrefFor/detailHref in ./detail-routes.
 */

/** Hosts this app is entitled to open. Must match the AASA file's appIDs host set. */
const APP_LINK_HOSTS = new Set(['travels-manager.com', 'www.travels-manager.com']);

/**
 * Paths the app must NEVER swallow. Mirrors the `exclude` components in
 * public/.well-known/apple-app-site-association — the entitlement is the real
 * enforcement, this is the second line of defence if the two ever drift.
 *
 * /auth matters most: the OAuth redirect lands there, and hijacking it into the
 * app (which has no /auth/callback route — it is stripped from the static
 * export) would break Google and Apple sign-in for every user.
 */
const NEVER_HANDLE = [/^\/api(\/|$)/, /^\/auth(\/|$)/, /^\/tour(\/|$)/];

/** Pure core — platform passed explicitly so tests don't need to mock Capacitor. */
export function toInAppPathFor(isNative: boolean, url: string): string | null {
  const afterScheme = url.replace(/^travelmanager:\/\//i, '');
  if (afterScheme !== url) {
    if (afterScheme.length === 0) return '/';
    return normalizeDeepLinkFor(isNative, `/${afterScheme.replace(/^\/+/, '')}`);
  }

  if (!/^https?:\/\//i.test(url)) return null;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  if (!APP_LINK_HOSTS.has(parsed.host.toLowerCase())) return null;
  if (NEVER_HANDLE.some((re) => re.test(parsed.pathname))) return null;

  // normalizeDeepLinkFor rewrites /trips/<id> to the static-export-safe
  // /trips/detail?id=<id>; anything without a dynamic segment passes through.
  return normalizeDeepLinkFor(isNative, `${parsed.pathname}${parsed.search}${parsed.hash}`);
}

/** Platform-bound wrapper around toInAppPathFor. */
export function toInAppPath(url: string): string | null {
  return toInAppPathFor(isNativePlatform(), url);
}
