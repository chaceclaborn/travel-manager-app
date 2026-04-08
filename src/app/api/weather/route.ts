import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/travelmanager/auth';
import { rateLimit } from '@/lib/rate-limit';

/**
 * Weather proxy to Open-Meteo.
 *
 * Why a proxy instead of calling Open-Meteo directly from the client?
 *   1. Avoids any future CORS surprises (we control the contract).
 *   2. Lets us add caching/throttling later without changing clients.
 *   3. Hides the upstream URL from browser devtools/users.
 *
 * Auth is required (requireAuth) to prevent random abuse — an authed user
 * being able to query any lat/lng is fine; it's a free public dataset.
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResult = rateLimit(request, 'read');
    if (rateLimitResult) return rateLimitResult;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const params = request.nextUrl.searchParams;
    const lat = Number(params.get('lat'));
    const lng = Number(params.get('lng'));

    if (isNaN(lat) || isNaN(lng)) {
      return NextResponse.json(
        { error: 'lat and lng are required and must be valid numbers' },
        { status: 400 }
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const upstream = new URL('https://api.open-meteo.com/v1/forecast');
      upstream.searchParams.set('latitude', String(lat));
      upstream.searchParams.set('longitude', String(lng));
      upstream.searchParams.set('current', 'temperature_2m,weather_code');
      upstream.searchParams.set(
        'daily',
        'temperature_2m_max,temperature_2m_min,weather_code'
      );
      upstream.searchParams.set('timezone', 'auto');
      upstream.searchParams.set('forecast_days', '7');
      upstream.searchParams.set('temperature_unit', 'fahrenheit');

      const res = await fetch(upstream.toString(), {
        signal: controller.signal,
        // Cache at the edge for 15 minutes — weather doesn't change that fast.
        next: { revalidate: 900 },
      });
      clearTimeout(timeout);

      if (!res.ok) {
        return NextResponse.json(
          { error: `Upstream weather API returned ${res.status}` },
          { status: 502 }
        );
      }

      const data = await res.json();
      return NextResponse.json(data, {
        headers: {
          'Cache-Control': 'public, max-age=900, s-maxage=900',
        },
      });
    } catch (err) {
      clearTimeout(timeout);
      console.error(
        'Weather proxy error:',
        err instanceof Error ? err.message : err
      );
      return NextResponse.json(
        { error: 'Failed to fetch weather' },
        { status: 502 }
      );
    }
  } catch (error) {
    console.error(
      'Weather route error:',
      error instanceof Error ? error.message : error
    );
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
