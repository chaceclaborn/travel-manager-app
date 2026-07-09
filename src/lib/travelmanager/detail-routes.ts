import { isNativePlatform } from '@/lib/mobile-auth';

/**
 * Platform-aware links to entity detail pages.
 *
 * Why this exists: the Capacitor iOS bundle is a Next.js static export, and
 * dynamic routes like /trips/[id] are stashed out of that build (see
 * scripts/build-mobile.mjs) because they can't be pre-rendered for arbitrary
 * ids. Navigating to them in the native app hard-404s and Capacitor falls
 * back to index.html — the "tap a trip, land back on the dashboard" bug.
 *
 * Every in-app link to a detail page MUST go through detailHref():
 *   - web    → /trips/<id>            (pretty URL, dynamic route exists)
 *   - native → /trips/detail?id=<id>  (static route, ships in the bundle)
 *
 * src/lib/mobile-export/static-routes.test.ts enforces this: any hardcoded
 * link to a route missing from the mobile export fails CI.
 */

export type DetailEntity = 'trips' | 'clients' | 'vendors' | 'bookings';

const DETAIL_ENTITIES: readonly DetailEntity[] = ['trips', 'clients', 'vendors', 'bookings'];

/** Pure core — platform passed explicitly so tests don't need to mock Capacitor. */
export function detailHrefFor(isNative: boolean, entity: DetailEntity, id: string): string {
  return isNative
    ? `/${entity}/detail?id=${encodeURIComponent(id)}`
    : `/${entity}/${encodeURIComponent(id)}`;
}

/** Href for an entity's detail page on the current platform. */
export function detailHref(entity: DetailEntity, id: string): string {
  return detailHrefFor(isNativePlatform(), entity, id);
}

/**
 * Rewrite an internal deep link (push notification payload, share URL path)
 * to a route that exists on the current platform. The server always sends
 * canonical web-shaped paths like /trips/<id>; on native those must become
 * /trips/detail?id=<id>. Non-detail paths pass through unchanged.
 */
export function normalizeDeepLinkFor(isNative: boolean, url: string): string {
  if (!isNative || !url.startsWith('/')) return url;
  const [path] = url.split(/[?#]/, 1);
  const rest = url.slice(path.length); // ?query and/or #hash
  const segments = path.split('/').filter(Boolean);
  if (segments.length !== 2) return url;
  const [entity, rawId] = segments;
  if (!(DETAIL_ENTITIES as readonly string[]).includes(entity)) return url;
  // Static sibling routes (/trips/new, /trips/detail) are not detail ids.
  if (rawId === 'new' || rawId === 'detail') return url;
  // Malformed percent-encoding must not throw inside a notification-tap
  // handler — fall back to the raw segment (detailHrefFor re-encodes it).
  let id = rawId;
  try {
    id = decodeURIComponent(rawId);
  } catch {
    /* keep rawId */
  }
  let normalized = detailHrefFor(true, entity as DetailEntity, id);
  // Carry any extra query params (e.g. /trips/<id>?edit=true) onto the
  // rewritten URL; without rewriting, such a link 404s on native too.
  if (rest.startsWith('?')) {
    const hashIdx = rest.indexOf('#');
    const query = hashIdx === -1 ? rest.slice(1) : rest.slice(1, hashIdx);
    const hash = hashIdx === -1 ? '' : rest.slice(hashIdx);
    if (query) normalized += `&${query}`;
    normalized += hash;
  } else {
    normalized += rest; // bare #hash (or nothing)
  }
  return normalized;
}

/** Platform-bound wrapper around normalizeDeepLinkFor. */
export function normalizeDeepLink(url: string): string {
  return normalizeDeepLinkFor(isNativePlatform(), url);
}
