import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  detailHrefFor,
  normalizeDeepLinkFor,
  type DetailEntity,
} from './detail-routes';

// Regression suite for the "tap a trip → bounced back to the dashboard" bug:
// the Capacitor static export has no /trips/[id] (build-mobile.mjs stashes
// dynamic routes), so native navigation must use /trips/detail?id=<id>.

const ENTITIES: DetailEntity[] = ['trips', 'clients', 'vendors', 'bookings'];

describe('detailHrefFor', () => {
  it('uses pretty dynamic URLs on the web', () => {
    expect(detailHrefFor(false, 'trips', 'abc-123')).toBe('/trips/abc-123');
  });

  it('uses the static query-param route on native (route exists in the export)', () => {
    expect(detailHrefFor(true, 'trips', 'abc-123')).toBe('/trips/detail?id=abc-123');
  });

  it.each(ENTITIES)('covers the %s entity on both platforms', (entity) => {
    expect(detailHrefFor(false, entity, 'x1')).toBe(`/${entity}/x1`);
    expect(detailHrefFor(true, entity, 'x1')).toBe(`/${entity}/detail?id=x1`);
  });

  it('URL-encodes ids', () => {
    expect(detailHrefFor(true, 'trips', 'a b&c')).toBe('/trips/detail?id=a%20b%26c');
    expect(detailHrefFor(false, 'trips', 'a b')).toBe('/trips/a%20b');
  });
});

describe('normalizeDeepLinkFor', () => {
  it('rewrites server-sent detail paths to the native query route', () => {
    // /trips/<id> is exactly what src/lib/push/{dispatch,reminders}.ts put in
    // push payloads — on native it must be rewritten or the tap dead-ends.
    expect(normalizeDeepLinkFor(true, '/trips/uuid-123')).toBe('/trips/detail?id=uuid-123');
    expect(normalizeDeepLinkFor(true, '/bookings/b1')).toBe('/bookings/detail?id=b1');
  });

  it('is the identity on the web', () => {
    expect(normalizeDeepLinkFor(false, '/trips/uuid-123')).toBe('/trips/uuid-123');
  });

  it('passes through static routes untouched', () => {
    for (const url of ['/meetings', '/trips', '/trips/new', '/trips/detail', '/settings', '/']) {
      expect(normalizeDeepLinkFor(true, url)).toBe(url);
    }
  });

  it('passes through non-internal and non-matching urls', () => {
    expect(normalizeDeepLinkFor(true, 'https://example.com/trips/x')).toBe(
      'https://example.com/trips/x'
    );
    expect(normalizeDeepLinkFor(true, '')).toBe('');
    expect(normalizeDeepLinkFor(true, '/trips/a/b')).toBe('/trips/a/b');
    expect(normalizeDeepLinkFor(true, '/unknown/entity-id')).toBe('/unknown/entity-id');
  });

  it('carries extra query params onto the rewritten native URL', () => {
    expect(normalizeDeepLinkFor(true, '/trips/abc?edit=true')).toBe(
      '/trips/detail?id=abc&edit=true'
    );
    expect(normalizeDeepLinkFor(true, '/trips/abc?edit=true#section')).toBe(
      '/trips/detail?id=abc&edit=true#section'
    );
    expect(normalizeDeepLinkFor(true, '/trips/abc#section')).toBe(
      '/trips/detail?id=abc#section'
    );
  });

  it('never throws on malformed percent-encoding (push payloads are untrusted)', () => {
    expect(normalizeDeepLinkFor(true, '/trips/100%')).toBe('/trips/detail?id=100%25');
    expect(normalizeDeepLinkFor(true, '/trips/%zz')).toBe('/trips/detail?id=%25zz');
  });
});

describe('push notification tap handler', () => {
  it('routes deep links through normalizeDeepLink (mutation guard)', () => {
    // The dynamic push argument is invisible to the static route firewall, so
    // pin the source directly: reverting push(normalizeDeepLink(url)) back to
    // push(url) re-introduces the "notification tap bounces to dashboard" bug
    // without failing any behavioral test.
    const source = readFileSync(
      path.resolve(__dirname, '../../components/travelmanager/PushRegister.tsx'),
      'utf8'
    );
    expect(source).toContain('.push(normalizeDeepLink(url))');
    expect(source).not.toMatch(/\.push\(url\)/);
  });
});
