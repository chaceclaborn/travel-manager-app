import { describe, it, expect } from 'vitest';
import { isDefinitivelyInvalid, hasStoredCredential } from './useAuth';

/**
 * Regression suite for "opening the app offline signs you out".
 *
 * The failure mode is asymmetric and worth stating: being too eager to declare
 * a session bad locks a signed-in traveller out of their itinerary at exactly
 * the moment they cannot sign back in (no signal). Being too reluctant costs
 * nothing — the server still rejects a bad token on every request, so a stale
 * local session grants no access to data.
 *
 * These are the two predicates the redirect decision rests on. The first
 * version of this fix got the second one wrong: it treated "getSession()
 * returned no session" as "not signed in", but auth-js also returns no session
 * when it cannot REFRESH an expired token offline — while deliberately keeping
 * the session in storage and emitting no SIGNED_OUT.
 */

describe('isDefinitivelyInvalid', () => {
  it('treats 401 as a definitive rejection', () => {
    expect(isDefinitivelyInvalid({ status: 401 })).toBe(true);
  });

  it('treats 403 as a definitive rejection', () => {
    expect(isDefinitivelyInvalid({ status: 403 })).toBe(true);
  });

  it.each([
    ['offline fetch failure (status 0)', { status: 0 }],
    ['no status at all', { message: 'Failed to fetch' }],
    ['a server error', { status: 500 }],
    ['a bad gateway', { status: 502 }],
    ['a gateway timeout', { status: 504 }],
    ['a rate limit', { status: 429 }],
  ])('does NOT sign the user out on %s', (_label, error) => {
    expect(isDefinitivelyInvalid(error)).toBe(false);
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
  ])('handles %s without throwing', (_label, error) => {
    expect(isDefinitivelyInvalid(error)).toBe(false);
  });

  it('ignores a status hidden on a nested cause', () => {
    // Only a top-level status counts; anything else is "unknown", which is the
    // safe direction.
    expect(isDefinitivelyInvalid({ cause: { status: 401 } })).toBe(false);
  });
});

describe('hasStoredCredential', () => {
  it('is true when getSession returned a user', () => {
    expect(hasStoredCredential({ id: 'u1' }, null)).toBe(true);
  });

  it('is true when getSession failed — the token exists, it just could not be refreshed', () => {
    // THE regression. auth-js returns { session: null, error } when an expired
    // token cannot be refreshed offline, and leaves the session in storage.
    // Reading this as "signed out" is what bounced people to /tour.
    const retryable = { name: 'AuthRetryableFetchError', status: 0 };
    expect(hasStoredCredential(null, retryable)).toBe(true);
  });

  it('is false only when there is no session AND no error — a genuine sign-out', () => {
    expect(hasStoredCredential(null, null)).toBe(false);
  });

  it('is false for undefined/undefined', () => {
    expect(hasStoredCredential(undefined, undefined)).toBe(false);
  });
});

describe('the offline cold-launch decision, end to end', () => {
  // Mirrors init(): declare auth bad only when the server rejected the token,
  // or when there is no credential on the device at all.
  const shouldRedirect = (cached: unknown, sessionError: unknown, getUserError: unknown) =>
    isDefinitivelyInvalid(getUserError) || !hasStoredCredential(cached, sessionError);

  it('does NOT redirect: valid stored session, offline (token still fresh)', () => {
    expect(shouldRedirect({ id: 'u1' }, null, { status: 0 })).toBe(false);
  });

  it('does NOT redirect: EXPIRED stored token, offline — the exact reported bug', () => {
    expect(shouldRedirect(null, { status: 0 }, { status: 0 })).toBe(false);
  });

  it('does NOT redirect: server briefly 500s', () => {
    expect(shouldRedirect({ id: 'u1' }, null, { status: 500 })).toBe(false);
  });

  it('DOES redirect: server says the token is invalid', () => {
    expect(shouldRedirect({ id: 'u1' }, null, { status: 401 })).toBe(true);
  });

  it('DOES redirect: never signed in on this device, offline', () => {
    expect(shouldRedirect(null, null, { status: 0 })).toBe(true);
  });

  it('DOES redirect: signed out locally, then a 5xx on revalidation', () => {
    // No credential on the device is decisive on its own — there is nothing to
    // restore even though the error itself is inconclusive.
    expect(shouldRedirect(null, null, { status: 503 })).toBe(true);
  });
});
