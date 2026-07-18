import { NextRequest, NextResponse } from 'next/server';
import { getAllStops } from '@/lib/travelmanager/stops';
import { requireAuth } from '@/lib/travelmanager/auth';
import { rateLimit } from '@/lib/rate-limit';

/**
 * GET /api/stops — every stop across the user's trips, ordered by trip and
 * route position. Powers the global travel map's full-route rendering.
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimited = rateLimit(request, 'read');
    if (rateLimited) return rateLimited;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const stops = await getAllStops(user.id);
    return NextResponse.json(stops);
  } catch (error) {
    console.error('Error fetching all stops:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to fetch stops' }, { status: 500 });
  }
}
