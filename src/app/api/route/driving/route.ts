import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/travelmanager/auth';
import { rateLimit } from '@/lib/rate-limit';

function parseLatLng(value: string | null): [number, number] | null {
  if (!value) return null;
  const parts = value.split(',').map(Number);
  if (parts.length !== 2 || !parts.every(Number.isFinite)) return null;
  const [lat, lng] = parts;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return [lat, lng];
}

/**
 * GET /api/route/driving?from=lat,lng&to=lat,lng
 *
 * Server-side proxy to the OSRM public router (same OpenStreetMap ecosystem
 * as our Nominatim geocode proxy). Returns real road distance and the route
 * geometry so driving legs show actual road miles, not straight lines.
 * Proxied so the browser only ever talks to our origin (CSP stays tight)
 * and requests are rate-limited per user.
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimited = rateLimit(request, 'read');
    if (rateLimited) return rateLimited;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const from = parseLatLng(request.nextUrl.searchParams.get('from'));
    const to = parseLatLng(request.nextUrl.searchParams.get('to'));
    if (!from || !to) {
      return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 });
    }

    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${from[1]},${from[0]};${to[1]},${to[0]}` +
      `?overview=full&geometries=geojson&alternatives=false&steps=false`;

    const res = await fetch(url, {
      headers: { 'User-Agent': 'TravelManager/1.0' },
      // Road networks don't change often — let Vercel's data cache absorb
      // repeat lookups for the same leg instead of hammering the public OSRM.
      next: { revalidate: 60 * 60 * 24 },
    });
    if (!res.ok) {
      return NextResponse.json({ error: 'Routing service error' }, { status: 502 });
    }

    const data = await res.json();
    const route = data?.routes?.[0];
    if (data?.code !== 'Ok' || !route) {
      return NextResponse.json({ error: 'No route found' }, { status: 404 });
    }

    return NextResponse.json({
      distanceMeters: route.distance,
      durationSeconds: route.duration,
      // GeoJSON is [lng, lat]; flip to Leaflet's [lat, lng] here so the
      // client can hand it straight to a Polyline.
      geometry: (route.geometry?.coordinates ?? []).map(
        (c: [number, number]) => [c[1], c[0]]
      ),
    });
  } catch (error) {
    console.error('Driving route error:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to fetch route' }, { status: 500 });
  }
}
