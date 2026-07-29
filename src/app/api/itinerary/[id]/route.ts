import { NextRequest, NextResponse } from 'next/server';
import { updateItineraryItem, deleteItineraryItem } from '@/lib/travelmanager/trips';
import { requireAuth } from '@/lib/travelmanager/auth';
import { requireTripAccess, TripAccessError } from '@/lib/travelmanager/trip-access';
import { rateLimit } from '@/lib/rate-limit';
import prisma from '@/lib/prisma';
import { sanitizeObject, validateUUID, validateDateString } from '@/lib/sanitize';

/**
 * These flat routes carry no tripId, so the item has to be read first purely to
 * find out which trip authorizes it. The UI sends every itinerary edit here
 * rather than to /api/trips/[id]/itinerary — authorizing only the trip-scoped
 * routes would leave this one wide open to any signed-in caller.
 */
async function tripIdForItem(id: string): Promise<string | null> {
  const item = await prisma.itineraryItem.findUnique({ where: { id }, select: { tripId: true } });
  return item?.tripId ?? null;
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const rateLimited = rateLimit(request, 'write');
    if (rateLimited) return rateLimited;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id } = await params;
    if (!validateUUID(id)) {
      return NextResponse.json({ error: 'Invalid itinerary item ID' }, { status: 400 });
    }

    const tripId = await tripIdForItem(id);
    if (!tripId) {
      return NextResponse.json({ error: 'Itinerary item not found' }, { status: 404 });
    }
    const access = await requireTripAccess(tripId, user.id, 'edit');

    const body = await request.json();
    const sanitized = sanitizeObject(body, ['title', 'date', 'endDate', 'startTime', 'endTime', 'location', 'notes', 'sortOrder', 'vendorId', 'clientId']);

    if (sanitized.date && !validateDateString(sanitized.date as string)) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
    }

    if (sanitized.endDate && !validateDateString(sanitized.endDate as string)) {
      return NextResponse.json({ error: 'Invalid end date format' }, { status: 400 });
    }

    if (sanitized.vendorId && !validateUUID(sanitized.vendorId as string)) {
      return NextResponse.json({ error: 'Invalid vendor ID' }, { status: 400 });
    }

    if (sanitized.clientId && !validateUUID(sanitized.clientId as string)) {
      return NextResponse.json({ error: 'Invalid client ID' }, { status: 400 });
    }

    // Vendors and clients are the owner's address book, not the trip's, so a
    // collaborator has nothing to link here and no way to be shown one. Reject
    // explicitly rather than let the vendor lookup fail as an opaque 500.
    if (!access.isOwner && (sanitized.vendorId || sanitized.clientId)) {
      return NextResponse.json(
        { error: 'Only the trip owner can link vendors or clients' },
        { status: 403 }
      );
    }

    const item = await updateItineraryItem(id, sanitized as Parameters<typeof updateItineraryItem>[1], user.id);
    return NextResponse.json(item);
  } catch (error) {
    if (error instanceof TripAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error updating itinerary item:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to update itinerary item' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const rateLimited = rateLimit(request, 'write');
    if (rateLimited) return rateLimited;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id } = await params;
    if (!validateUUID(id)) {
      return NextResponse.json({ error: 'Invalid itinerary item ID' }, { status: 400 });
    }

    const tripId = await tripIdForItem(id);
    if (!tripId) {
      return NextResponse.json({ error: 'Itinerary item not found' }, { status: 404 });
    }
    await requireTripAccess(tripId, user.id, 'edit');

    await deleteItineraryItem(id, user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof TripAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error deleting itinerary item:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to delete itinerary item' }, { status: 500 });
  }
}
