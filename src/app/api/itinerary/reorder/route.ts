import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/travelmanager/auth';
import { rateLimit } from '@/lib/rate-limit';
import { sanitizeObject, validateUUID } from '@/lib/sanitize';

/**
 * POST /api/itinerary/reorder
 * Body: { tripId: string, orderedIds: string[] }
 *
 * Updates `sortOrder` for every itinerary item in `orderedIds` to match its
 * position in the array, in a single transaction. Ownership is verified by
 * looking up the trip under the current user and confirming every id in the
 * payload belongs to that trip.
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

    if (!orderedIds.every((id): id is string => typeof id === 'string' && validateUUID(id))) {
      return NextResponse.json({ error: 'orderedIds must be valid UUIDs' }, { status: 400 });
    }

    // Verify trip ownership
    const trip = await prisma.trip.findFirst({ where: { id: tripId, userId: user.id } });
    if (!trip) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }

    // Verify all ids belong to this trip (prevents cross-trip reordering attacks)
    const existing = await prisma.itineraryItem.findMany({
      where: { id: { in: orderedIds }, tripId },
      select: { id: true },
    });
    if (existing.length !== orderedIds.length) {
      return NextResponse.json({ error: 'Some itinerary items do not belong to this trip' }, { status: 400 });
    }

    await prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.itineraryItem.update({
          where: { id },
          data: { sortOrder: index },
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error reordering itinerary items:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to reorder itinerary items' }, { status: 500 });
  }
}
