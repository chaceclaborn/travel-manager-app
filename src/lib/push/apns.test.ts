import { describe, it, expect, afterEach } from 'vitest';
import crypto from 'node:crypto';
import {
  signProviderToken,
  buildApnsBody,
  isTokenDead,
  getApnsConfig,
  type ApnsConfig,
} from './apns';

function makeKeyPair() {
  return crypto.generateKeyPairSync('ec', {
    namedCurve: 'P-256',
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
}

function decodeSegment(seg: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(seg, 'base64url').toString('utf8'));
}

describe('signProviderToken', () => {
  it('produces a valid ES256 JWT with the expected header + claims', () => {
    const { privateKey, publicKey } = makeKeyPair();
    const config: ApnsConfig = {
      keyId: 'ABC123DEF4',
      teamId: 'TEAM123456',
      bundleId: 'com.chaceclaborn.travelmanager',
      key: privateKey,
      host: 'api.push.apple.com',
    };

    const jwt = signProviderToken(config, 1_700_000_000);
    const [headerB64, payloadB64, sigB64] = jwt.split('.');

    expect(decodeSegment(headerB64)).toEqual({ alg: 'ES256', kid: 'ABC123DEF4' });
    expect(decodeSegment(payloadB64)).toEqual({ iss: 'TEAM123456', iat: 1_700_000_000 });

    // Signature must verify against the public key using the raw r||s encoding
    // APNs requires (Node's default DER would fail here).
    const verified = crypto.verify(
      'sha256',
      Buffer.from(`${headerB64}.${payloadB64}`),
      { key: publicKey, dsaEncoding: 'ieee-p1363' },
      Buffer.from(sigB64, 'base64url')
    );
    expect(verified).toBe(true);
  });
});

describe('buildApnsBody', () => {
  it('nests alert under aps, defaults sound, and merges custom data at top level', () => {
    const body = JSON.parse(
      buildApnsBody({
        title: 'Trip departs tomorrow',
        body: 'Paris departs tomorrow.',
        data: { type: 'trip_reminder', url: '/trips/abc' },
      })
    );
    expect(body.aps.alert).toEqual({ title: 'Trip departs tomorrow', body: 'Paris departs tomorrow.' });
    expect(body.aps.sound).toBe('default');
    expect(body.type).toBe('trip_reminder');
    expect(body.url).toBe('/trips/abc');
  });

  it('includes badge and thread-id when provided', () => {
    const body = JSON.parse(
      buildApnsBody({ title: 't', body: 'b', badge: 3, threadId: 'trips' })
    );
    expect(body.aps.badge).toBe(3);
    expect(body.aps['thread-id']).toBe('trips');
  });
});

describe('isTokenDead', () => {
  it('flags 410 and 400/BadDeviceToken as dead, keeps others alive', () => {
    expect(isTokenDead({ token: 'x', status: 410, ok: false, reason: 'Unregistered' })).toBe(true);
    expect(isTokenDead({ token: 'x', status: 400, ok: false, reason: 'BadDeviceToken' })).toBe(true);
    expect(isTokenDead({ token: 'x', status: 400, ok: false, reason: 'DeviceTokenNotForTopic' })).toBe(true);
    expect(isTokenDead({ token: 'x', status: 200, ok: true })).toBe(false);
    expect(isTokenDead({ token: 'x', status: 429, ok: false, reason: 'TooManyRequests' })).toBe(false);
    expect(isTokenDead({ token: 'x', status: 0, ok: false, reason: 'timeout' })).toBe(false);
  });
});

describe('getApnsConfig', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it('returns null when any required var is missing', () => {
    delete process.env.APNS_KEY_ID;
    delete process.env.APNS_TEAM_ID;
    delete process.env.APNS_BUNDLE_ID;
    delete process.env.APNS_KEY;
    expect(getApnsConfig()).toBeNull();
  });

  it('normalizes escaped newlines in the PEM key and defaults host to prod', () => {
    process.env.APNS_KEY_ID = 'KEY1234567';
    process.env.APNS_TEAM_ID = 'TEAM123456';
    process.env.APNS_BUNDLE_ID = 'com.chaceclaborn.travelmanager';
    process.env.APNS_KEY = '-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----';
    delete process.env.APNS_HOST;

    const config = getApnsConfig();
    expect(config).not.toBeNull();
    expect(config!.key).toBe('-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----');
    expect(config!.host).toBe('api.push.apple.com');
  });
});
