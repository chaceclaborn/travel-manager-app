import { NextRequest, NextResponse } from 'next/server';
import { reorderStops } from '@/lib/travelmanager/stops';
import { requireAuth } from '@/lib/travelmanager/auth';
import { requireTripAccess, TripAccessError } from '@/lib/travelmanager/trip-access';
import { rateLimit } from '@/lib/rate-limit';
import { sanitizeObject, validateUUID } from '@/lib/sanitize';

/**
 * POST /api/stops/reorder
 * Body: { tripId: string, orderedIds: string[] }
 *
 * Mirrors /api/itinerary/reorder: updates `sortOrder` for every stop to
 * match its position in `orderedIds`, in a single transaction, after
 * verifying trip access and that every id belongs to the trip.
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimited = rateLimit(request, 'write');
    if (rateLimited) return rateLimited;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const body = await request.json();
    const sanitized = sanitizeObject(body, ['tripId', 'orderedIds']);

    const tripId = sanitized.tripId as string | undefined;
    const orderedIds = sanitized.orderedIds as unknown;

    if (!tripId || !validateUUID(tripId)) {
      return NextResponse.json({ error: 'Invalid trip ID' }, { status: 400 });
    }
    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      return NextResponse.json({ error: 'orderedIds must be a non-empty array' }, { status: 400 });
    }
    // DoS guard, same rationale as the itinerary reorder endpoint
    if (orderedIds.length > 200) {
      return NextResponse.json({ error: 'orderedIds cannot exceed 200 items' }, { status: 400 });
    }
    if (!orderedIds.every((id): id is string => typeof id === 'string' && validateUUID(id))) {
      return NextResponse.json({ error: 'orderedIds must be valid IDs' }, { status: 400 });
    }

    await requireTripAccess(tripId, user.id, 'edit');

    await reorderStops(tripId, user.id, orderedIds);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof TripAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error reordering stops:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to reorder stops' }, { status: 500 });
  }
}
