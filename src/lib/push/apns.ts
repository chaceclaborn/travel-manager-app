/**
 * APNs (Apple Push Notification service) provider — SERVER ONLY.
 *
 * Talks to APNs over HTTP/2 using a token-based (.p8) provider key. No external
 * dependency: JWT signing uses `node:crypto` (ES256) and delivery uses
 * `node:http2`. This is the modern, recommended APNs integration — one .p8 key
 * covers sandbox + production and never expires.
 *
 * Never import this from client code: it pulls in Node built-ins that don't
 * exist in the browser/WKWebView bundle. Route handlers (Node runtime) only.
 *
 * Configuration (all server-side env vars; see docs/PUSH_NOTIFICATIONS.md):
 *   APNS_KEY_ID     10-char Key ID of the APNs .p8 key
 *   APNS_TEAM_ID    10-char Apple Team ID
 *   APNS_BUNDLE_ID  com.chaceclaborn.travelmanager  (the apns-topic)
 *   APNS_KEY        contents of AuthKey_XXXX.p8 (PEM, BEGIN/END PRIVATE KEY)
 *   APNS_HOST       api.push.apple.com (prod, default) | api.sandbox.push.apple.com (dev)
 */

import http2 from 'node:http2';
import crypto from 'node:crypto';

const {
  HTTP2_HEADER_METHOD,
  HTTP2_HEADER_PATH,
  HTTP2_HEADER_STATUS,
} = http2.constants;

const PROD_HOST = 'api.push.apple.com';
const SANDBOX_HOST = 'api.sandbox.push.apple.com';

/** How long a single HTTP/2 session may stay open before we give up on it. */
const SESSION_TIMEOUT_MS = 10_000;
/**
 * Reuse the signed provider token for this long. APNs requires it be refreshed
 * no more often than every 20 min and be no older than 60 min — 50 min sits
 * safely inside that window and minimizes signing work.
 */
const TOKEN_TTL_MS = 50 * 60 * 1000;

export interface ApnsConfig {
  keyId: string;
  teamId: string;
  bundleId: string;
  /** PEM contents of the .p8 key (PKCS#8 EC private key). */
  key: string;
  host: string;
}

export interface ApnsPayload {
  title: string;
  body: string;
  /** Custom top-level keys surfaced to the app as `notification.data` (e.g. url, tripId, type). */
  data?: Record<string, unknown>;
  badge?: number;
  sound?: string;
  /** iOS notification-grouping id. */
  threadId?: string;
}

export interface ApnsResult {
  token: string;
  /** HTTP status from APNs, or 0 on a transport-level failure. */
  status: number;
  ok: boolean;
  /** APNs failure reason string (e.g. "Unregistered", "BadDeviceToken"). */
  reason?: string;
}

/**
 * Read + validate APNs config from the environment. Returns null when any
 * required var is missing, which is the signal to callers that push delivery is
 * not configured (they no-op instead of erroring).
 */
export function getApnsConfig(): ApnsConfig | null {
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  const bundleId = process.env.APNS_BUNDLE_ID;
  const key = process.env.APNS_KEY;
  if (!keyId || !teamId || !bundleId || !key) return null;

  // Env-var storage (Vercel dashboard, .env files) commonly collapses the PEM
  // into a single line with literal "\n" sequences. Restore real newlines so
  // crypto can parse the key.
  const normalizedKey = key.includes('\\n') ? key.replace(/\\n/g, '\n') : key;

  return {
    keyId,
    teamId,
    bundleId,
    key: normalizedKey,
    host: process.env.APNS_HOST || PROD_HOST,
  };
}

export function isApnsConfigured(): boolean {
  return getApnsConfig() !== null;
}

function base64url(input: Buffer | string): string {
  return (typeof input === 'string' ? Buffer.from(input) : input).toString('base64url');
}

/**
 * Sign an APNs provider JWT (ES256). Pure — no caching — so it's unit-testable
 * with a generated key + fixed clock. `nowSec` is the token's `iat`.
 */
export function signProviderToken(config: ApnsConfig, nowSec: number): string {
  const header = { alg: 'ES256', kid: config.keyId };
  const claims = { iss: config.teamId, iat: nowSec };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;
  // dsaEncoding: 'ieee-p1363' yields the raw r||s signature JWS/ES256 requires
  // (Node's default is DER, which APNs rejects).
  const signature = crypto.sign('sha256', Buffer.from(signingInput), {
    key: config.key,
    dsaEncoding: 'ieee-p1363',
  });
  return `${signingInput}.${base64url(signature)}`;
}

let cachedToken: { jwt: string; keyId: string; expiresAt: number } | null = null;

/** Cached wrapper around {@link signProviderToken}. */
function getProviderToken(config: ApnsConfig, now = Date.now()): string {
  if (cachedToken && cachedToken.keyId === config.keyId && now < cachedToken.expiresAt) {
    return cachedToken.jwt;
  }
  const jwt = signProviderToken(config, Math.floor(now / 1000));
  cachedToken = { jwt, keyId: config.keyId, expiresAt: now + TOKEN_TTL_MS };
  return jwt;
}

/** Build the APNs JSON payload body. Exported for tests. */
export function buildApnsBody(p: ApnsPayload): string {
  const aps: Record<string, unknown> = {
    alert: { title: p.title, body: p.body },
    sound: p.sound ?? 'default',
  };
  if (typeof p.badge === 'number') aps.badge = p.badge;
  if (p.threadId) aps['thread-id'] = p.threadId;
  return JSON.stringify({ aps, ...(p.data ?? {}) });
}

/**
 * True when a delivery result means the token is dead and should be deleted:
 * 410 Unregistered, or a token APNs rejects as bad/for-the-wrong-topic (after
 * the sandbox/prod fallback has already been tried).
 */
export function isTokenDead(r: ApnsResult): boolean {
  if (r.status === 410) return true;
  return (
    r.status === 400 &&
    (r.reason === 'BadDeviceToken' || r.reason === 'DeviceTokenNotForTopic')
  );
}

/** Send one prepared body to a set of tokens over a single HTTP/2 session. */
function sendBatchOnHost(
  host: string,
  tokens: string[],
  jwt: string,
  body: string,
  bundleId: string
): Promise<ApnsResult[]> {
  return new Promise((resolve) => {
    const client = http2.connect(`https://${host}`);
    const results: ApnsResult[] = [];
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      try {
        client.close();
      } catch {
        /* already closing */
      }
      resolve(results);
    };

    // If the whole session fails (DNS, TLS, auth-key rejected at connect), mark
    // every token as a transport error rather than hanging the caller.
    const failAll = (reason: string) => {
      for (const token of tokens) {
        if (!results.some((r) => r.token === token)) {
          results.push({ token, status: 0, ok: false, reason });
        }
      }
      finish();
    };

    client.on('error', (err) => failAll(err.message));
    client.setTimeout(SESSION_TIMEOUT_MS, () => failAll('APNs session timeout'));

    let pending = tokens.length;
    for (const token of tokens) {
      const req = client.request({
        [HTTP2_HEADER_METHOD]: 'POST',
        [HTTP2_HEADER_PATH]: `/3/device/${token}`,
        authorization: `bearer ${jwt}`,
        'apns-topic': bundleId,
        'apns-push-type': 'alert',
        'apns-priority': '10',
      });

      let status = 0;
      let data = '';
      // A stream can emit both 'end' and 'error' in edge cases (e.g. an RST
      // after the response) — settle each request exactly once so `pending`
      // never double-decrements and resolves the batch early.
      let done = false;
      const settle = (result: ApnsResult) => {
        if (done) return;
        done = true;
        results.push(result);
        if (--pending === 0) finish();
      };
      req.on('response', (headers) => {
        status = Number(headers[HTTP2_HEADER_STATUS]) || 0;
      });
      req.setEncoding('utf8');
      req.on('data', (chunk) => {
        data += chunk;
      });
      req.on('end', () => {
        let reason: string | undefined;
        if (status !== 200 && data) {
          try {
            reason = JSON.parse(data).reason;
          } catch {
            /* non-JSON error body */
          }
        }
        settle({ token, status, ok: status === 200, reason });
      });
      req.on('error', (err) => {
        settle({ token, status: 0, ok: false, reason: err.message });
      });
      req.end(body);
    }
  });
}

/**
 * Deliver a notification to the given device tokens.
 *
 * Tokens APNs rejects with 400/BadDeviceToken (typically a sandbox token hitting
 * the production host, or vice-versa) are automatically retried on the other
 * host, so a developer's Xcode-run build and TestFlight/App Store users both
 * work without per-token environment bookkeeping.
 */
export async function sendApns(
  tokens: string[],
  payload: ApnsPayload,
  config: ApnsConfig
): Promise<ApnsResult[]> {
  if (tokens.length === 0) return [];

  const jwt = getProviderToken(config);
  const body = buildApnsBody(payload);

  const primary = await sendBatchOnHost(config.host, tokens, jwt, body, config.bundleId);

  const retryTokens = primary
    .filter((r) => r.status === 400 && r.reason === 'BadDeviceToken')
    .map((r) => r.token);
  if (retryTokens.length === 0) return primary;

  const fallbackHost = config.host === SANDBOX_HOST ? PROD_HOST : SANDBOX_HOST;
  const retry = await sendBatchOnHost(fallbackHost, retryTokens, jwt, body, config.bundleId);
  const retryByToken = new Map(retry.map((r) => [r.token, r]));

  return primary.map((r) => retryByToken.get(r.token) ?? r);
}

/** Test-only: reset the module-level provider-token cache. */
export function __resetProviderTokenCache(): void {
  cachedToken = null;
}
