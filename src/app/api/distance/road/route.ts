import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/travelmanager/auth';
import { rateLimit } from '@/lib/rate-limit';
import { haversineDistance } from '@/lib/distance';

function decodePolyline(encoded: string): [number, number][] {
  const decoded: [number, number][] = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let result = 0, shift = 0, byte = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    result = 0; shift = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    decoded.push([lat / 1e5, lng / 1e5]);
  }
  return decoded;
}

export async function GET(request: NextRequest) {
  try {
    const rateLimitResult = rateLimit(request, 'read');
    if (rateLimitResult) return rateLimitResult;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const params = request.nextUrl.searchParams;
    const fromLat = Number(params.get('fromLat'));
    const fromLng = Number(params.get('fromLng'));
    const toLat = Number(params.get('toLat'));
    const toLng = Number(params.get('toLng'));

    if ([fromLat, fromLng, toLat, toLng].some((v) => isNaN(v))) {
      return NextResponse.json({ error: 'fromLat, fromLng, toLat, and toLng are required and must be valid numbers' }, { status: 400 });
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);

      const res = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=simplified`,
        { signal: controller.signal }
      );
      clearTimeout(timeout);

      if (!res.ok) throw new Error(`OSRM responded with ${res.status}`);

      const data = await res.json();
      const route = data.routes?.[0];
      if (!route?.distance) throw new Error('No route found');

      const geometry = route.geometry ? decodePolyline(route.geometry) : null;

      return NextResponse.json({ distanceKm: route.distance / 1000, source: 'osrm', geometry });
    } catch {
      return NextResponse.json({
        distanceKm: haversineDistance(fromLat, fromLng, toLat, toLng),
        source: 'haversine',
        geometry: null,
      });
    }
  } catch (error) {
    console.error('Error calculating road distance:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to calculate distance' }, { status: 500 });
  }
}
