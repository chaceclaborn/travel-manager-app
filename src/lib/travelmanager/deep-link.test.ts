import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { toInAppPathFor } from './deep-link';

// Universal Links regression suite. The failure this guards against is subtle:
// a shared trip link that opens the app but strands the user on the dashboard,
// or — much worse — the app claiming /auth/* and breaking OAuth sign-in.

describe('toInAppPathFor — custom scheme', () => {
  it('routes a bare scheme URL', () => {
    expect(toInAppPathFor(true, 'travelmanager://trips')).toBe('/trips');
  });

  it('tolerates extra leading slashes', () => {
    expect(toInAppPathFor(true, 'travelmanager:///trips')).toBe('/trips');
  });

  it('preserves an already-static detail route', () => {
    expect(toInAppPathFor(true, 'travelmanager://trips/detail?id=abc')).toBe(
      '/trips/detail?id=abc'
    );
  });

  it('rewrites a dynamic detail path to the static export route', () => {
    expect(toInAppPathFor(true, 'travelmanager://trips/abc123')).toBe(
      '/trips/detail?id=abc123'
    );
  });

  it('sends a scheme-only URL to the dashboard rather than nowhere', () => {
    expect(toInAppPathFor(true, 'travelmanager://')).toBe('/');
  });
});

describe('toInAppPathFor — universal links', () => {
  it('routes an https trip link to the static detail route on native', () => {
    expect(toInAppPathFor(true, 'https://www.travels-manager.com/trips/abc123')).toBe(
      '/trips/detail?id=abc123'
    );
  });

  it('accepts the apex host as well as www (the apex 307s to www)', () => {
    expect(toInAppPathFor(true, 'https://travels-manager.com/trips/abc123')).toBe(
      '/trips/detail?id=abc123'
    );
  });

  it('is case-insensitive about the host', () => {
    expect(toInAppPathFor(true, 'https://WWW.Travels-Manager.com/trips')).toBe('/trips');
  });

  it('passes a share link through unchanged', () => {
    expect(toInAppPathFor(true, 'https://www.travels-manager.com/share/tok123')).toBe(
      '/share/tok123'
    );
  });

  it('keeps the query string and hash', () => {
    expect(
      toInAppPathFor(true, 'https://www.travels-manager.com/trips/abc?edit=true#notes')
    ).toBe('/trips/detail?id=abc&edit=true#notes');
  });

  it('ignores links to other hosts', () => {
    expect(toInAppPathFor(true, 'https://evil.example.com/trips/abc')).toBeNull();
  });

  it('ignores a host that merely ends with ours', () => {
    expect(toInAppPathFor(true, 'https://nottravels-manager.com/trips/abc')).toBeNull();
  });

  it('ignores non-http schemes it does not own', () => {
    expect(toInAppPathFor(true, 'com.googleusercontent.apps.123://oauth')).toBeNull();
  });

  it('ignores unparseable input instead of throwing', () => {
    expect(toInAppPathFor(true, 'https://')).toBeNull();
  });
});

describe('toInAppPathFor — paths the app must never swallow', () => {
  // Claiming these would break sign-in: /auth/callback does not exist in the
  // static export, so the app would open and dead-end mid-OAuth.
  it.each([
    'https://www.travels-manager.com/auth/callback?code=xyz',
    'https://www.travels-manager.com/auth',
    'https://www.travels-manager.com/api/trips',
    'https://www.travels-manager.com/tour?confirmed=1',
  ])('refuses %s', (url) => {
    expect(toInAppPathFor(true, url)).toBeNull();
  });

  it('does not refuse a path that merely starts with the same letters', () => {
    expect(toInAppPathFor(true, 'https://www.travels-manager.com/authors')).toBe('/authors');
  });
});

describe('toInAppPathFor — web platform', () => {
  it('leaves dynamic detail paths pretty on web', () => {
    expect(toInAppPathFor(false, 'https://www.travels-manager.com/trips/abc123')).toBe(
      '/trips/abc123'
    );
  });
});

describe('the AASA file matches these rules', () => {
  // The entitlement is the real enforcement; this guards against the file and
  // the code drifting apart, which is how /auth/* would silently get claimed.
  const aasa = JSON.parse(
    readFileSync(
      path.join(process.cwd(), 'public/.well-known/apple-app-site-association'),
      'utf8'
    )
  );

  it('is valid JSON with exactly one app detail entry', () => {
    expect(aasa.applinks.details).toHaveLength(1);
  });

  it('declares the production app ID', () => {
    expect(aasa.applinks.details[0].appIDs).toContain(
      'H2FK7C8RK2.com.chaceclaborn.travelmanager'
    );
  });

  it.each(['/api/*', '/auth/*', '/tour*'])('excludes %s', (pattern) => {
    const match = aasa.applinks.details[0].components.find(
      (c: Record<string, unknown>) => c['/'] === pattern
    );
    expect(match, `${pattern} must be listed`).toBeDefined();
    expect(match.exclude, `${pattern} must be excluded`).toBe(true);
  });

  it('claims the share path so a shared trip opens the app', () => {
    const patterns = aasa.applinks.details[0].components.map(
      (c: Record<string, unknown>) => c['/']
    );
    expect(patterns).toContain('/share/*');
  });
});
