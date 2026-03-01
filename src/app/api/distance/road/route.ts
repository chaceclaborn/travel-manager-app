import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/travelmanager/auth';
import { rateLimit } from '@/lib/rate-limit';
import { haversineDistance } from '@/lib/distance';

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
        `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=false`,
        { signal: controller.signal }
      );
      clearTimeout(timeout);

      if (!res.ok) throw new Error(`OSRM responded with ${res.status}`);

      const data = await res.json();
      if (!data.routes?.[0]?.distance) throw new Error('No route found');

      return NextResponse.json({ distanceKm: data.routes[0].distance / 1000, source: 'osrm' });
    } catch {
      return NextResponse.json({
        distanceKm: haversineDistance(fromLat, fromLng, toLat, toLng),
        source: 'haversine',
      });
    }
  } catch (error) {
    console.error('Error calculating road distance:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to calculate distance' }, { status: 500 });
  }
}
