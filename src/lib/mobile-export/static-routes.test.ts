import { describe, it, expect } from 'vitest';
import path from 'node:path';
import {
  getMobileRoutes,
  extractMobileNavTargets,
  targetResolves,
  DYN,
} from '../../../scripts/mobile-routes-lib.mjs';

/**
 * The mobile-bundle firewall.
 *
 * The Capacitor iOS app ships a Next.js static export where scripts/
 * build-mobile.mjs has stripped every dynamic [param] route plus /api and
 * /auth. A <Link> or router.push() to any of those hard-404s in the native
 * app and Capacitor falls back to index.html — the user lands back on the
 * dashboard (shipped as the trips bug in v1.0 build 3).
 *
 * This suite statically extracts every internal navigation target from src/
 * and asserts it resolves to a route that actually exists in the mobile
 * export. If you add a link to a new route, either the route must be
 * exportable (static path) or the link must go through detailHref() /
 * a platform-aware helper.
 */

const ROOT = path.resolve(__dirname, '../../..');
const APP_DIR = path.join(ROOT, 'src', 'app');
const SRC_DIR = path.join(ROOT, 'src');

const routes = getMobileRoutes(APP_DIR);
const navTargets = extractMobileNavTargets(SRC_DIR);

describe('mobile static export route set', () => {
  it('contains the core static routes', () => {
    for (const r of ['/', '/trips', '/trips/new', '/clients', '/vendors', '/bookings', '/settings']) {
      expect(routes).toContain(r);
    }
  });

  it('contains the query-param detail routes the native app navigates to', () => {
    for (const r of ['/trips/detail', '/clients/detail', '/vendors/detail', '/bookings/detail']) {
      expect(routes).toContain(r);
    }
  });

  it('does NOT contain dynamic [id] routes (they are stashed out of the export)', () => {
    // Documents WHY detailHref() exists: on native, /trips/<uuid> has no
    // matching file, so every id-based link must use /trips/detail?id=.
    expect(routes.every((r) => !r.includes('['))).toBe(true);
    expect(targetResolves(`/trips/${DYN}`, routes)).toBe(false);
  });

  it('excludes web-only (.web.tsx) and server (/api, /auth) routes', () => {
    expect(routes.some((r) => r.startsWith('/api'))).toBe(false);
    expect(routes.some((r) => r.startsWith('/auth'))).toBe(false);
    expect(routes.some((r) => r.startsWith('/share'))).toBe(false);
  });
});

describe('every internal navigation target resolves inside the mobile bundle', () => {
  it('found a meaningful number of nav targets (extractor sanity check)', () => {
    // If a refactor breaks the extraction regexes this suite would silently
    // pass on an empty list — guard against that.
    expect(navTargets.length).toBeGreaterThan(30);
  });

  it('has no link/push target that 404s in the iOS app', () => {
    const broken = navTargets.filter(({ target }) => !targetResolves(target, routes));
    const report = broken
      .map(({ file, target }) => `  ${file} → ${target}`)
      .join('\n');
    expect(
      broken,
      `These navigation targets do not exist in the mobile static export.\n` +
        `In the iOS app they hard-404 and bounce the user back to the dashboard.\n` +
        `Use detailHref()/normalizeDeepLink() from @/lib/travelmanager/detail-routes\n` +
        `or add a statically exportable route.\n${report}`
    ).toEqual([]);
  });
});
