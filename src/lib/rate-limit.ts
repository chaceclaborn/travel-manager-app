import { NextRequest, NextResponse } from 'next/server';

type RateLimitCategory = 'auth' | 'read' | 'write' | 'sensitive';

const LIMITS: Record<RateLimitCategory, { maxRequests: number; windowMs: number }> = {
  auth: { maxRequests: 10, windowMs: 60_000 },
  read: { maxRequests: 60, windowMs: 60_000 },
  write: { maxRequests: 30, windowMs: 60_000 },
  sensitive: { maxRequests: 5, windowMs: 60_000 },
};

interface RequestRecord {
  timestamps: number[];
}

const store = new Map<string, RequestRecord>();

const CLEANUP_INTERVAL_MS = 60_000;
let lastCleanup = Date.now();

function cleanupExpiredEntries() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;

  const maxWindow = Math.max(...Object.values(LIMITS).map((l) => l.windowMs));
  for (const [key, record] of store) {
    record.timestamps = record.timestamps.filter((t) => now - t < maxWindow);
    if (record.timestamps.length === 0) {
      store.delete(key);
    }
  }
}

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return request.headers.get('x-real-ip') ?? 'unknown';
}

export function rateLimit(
  request: NextRequest | Request,
  category: RateLimitCategory
): NextResponse | null {
  cleanupExpiredEntries();

  const { maxRequests, windowMs } = LIMITS[category];
  const ip = getClientIp(request as NextRequest);
  const key = `${ip}:${category}`;
  const now = Date.now();

  const record = store.get(key) ?? { timestamps: [] };

  // Sliding window: keep only timestamps within the current window
  record.timestamps = record.timestamps.filter((t) => now - t < windowMs);

  if (record.timestamps.length >= maxRequests) {
    const oldestInWindow = record.timestamps[0];
    const retryAfterMs = windowMs - (now - oldestInWindow);
    const retryAfterSec = Math.ceil(retryAfterMs / 1000);

    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfterSec),
          'X-RateLimit-Limit': String(maxRequests),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil((now + retryAfterMs) / 1000)),
        },
      }
    );
  }

  record.timestamps.push(now);
  store.set(key, record);

  return null;
}
