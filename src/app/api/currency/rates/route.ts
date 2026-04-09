import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/travelmanager/auth';
import { rateLimit } from '@/lib/rate-limit';

// In-memory cache keyed by base currency. Frankfurter rates only refresh once
// per day (ECB reference rates), so a 1-hour TTL is generous without being
// stale. Cache lives for the lifetime of the server process, which is fine
// here — worst case after a deploy we re-fetch 20-ish bases.
//
// Bounded to MAX_CACHE_ENTRIES with simple FIFO eviction to prevent an
// authenticated user from pinning memory by requesting arbitrary 3-letter
// codes. Map preserves insertion order, so `cache.keys().next().value` gives
// us the oldest entry in O(1).
const cache = new Map<string, { data: unknown; at: number }>();
const ONE_HOUR = 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 50;

export async function GET(request: NextRequest) {
  try {
    const limited = rateLimit(request, 'read');
    if (limited) return limited;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const base = (new URL(request.url).searchParams.get('base') || 'USD').toUpperCase();
    if (!/^[A-Z]{3}$/.test(base)) {
      return NextResponse.json({ error: 'Invalid base currency' }, { status: 400 });
    }

    const cached = cache.get(base);
    if (cached && Date.now() - cached.at < ONE_HOUR) {
      return NextResponse.json(cached.data);
    }

    const upstream = await fetch(`https://api.frankfurter.app/latest?from=${base}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!upstream.ok) {
      return NextResponse.json({ error: 'Rates service unavailable' }, { status: 502 });
    }
    const data = await upstream.json();

    // FIFO eviction when the cache is full. We only evict if this is a new
    // key; if we're refreshing an existing entry, `set` just updates in place
    // and insertion order is preserved.
    if (!cache.has(base) && cache.size >= MAX_CACHE_ENTRIES) {
      const oldest = cache.keys().next().value;
      if (oldest) cache.delete(oldest);
    }
    cache.set(base, { data, at: Date.now() });
    return NextResponse.json(data);
  } catch (error) {
    console.error('currency rates:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to fetch rates' }, { status: 500 });
  }
}
