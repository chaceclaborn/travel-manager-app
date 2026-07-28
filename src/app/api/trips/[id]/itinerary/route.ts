import { NextRequest, NextResponse } from 'next/server';
import { getTripItinerary, createItineraryItem } from '@/lib/travelmanager/trips';
import { requireAuth } from '@/lib/travelmanager/auth';
import { requireTripAccess, TripAccessError } from '@/lib/travelmanager/trip-access';
import { rateLimit } from '@/lib/rate-limit';
import { sanitizeObject, validateUUID, validateDateString } from '@/lib/sanitize';

const ITINERARY_ALLOWED_FIELDS = ['title', 'date', 'endDate', 'startTime', 'endTime', 'location', 'notes', 'sortOrder', 'vendorId', 'clientId'];

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const rateLimited = rateLimit(request, 'read');
    if (rateLimited) return rateLimited;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id } = await params;
    if (!validateUUID(id)) {
      return NextResponse.json({ error: 'Invalid trip ID' }, { status: 400 });
    }
    await requireTripAccess(id, user.id, 'view');

    const itinerary = await getTripItinerary(id, user.id);
    return NextResponse.json(itinerary);
  } catch (error) {
    if (error instanceof TripAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error fetching itinerary:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to fetch itinerary' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const rateLimited = rateLimit(request, 'write');
    if (rateLimited) return rateLimited;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id } = await params;
    if (!validateUUID(id)) {
      return NextResponse.json({ error: 'Invalid trip ID' }, { status: 400 });
    }

    const access = await requireTripAccess(id, user.id, 'edit');

    const body = await request.json();
    const sanitized = sanitizeObject(body, ITINERARY_ALLOWED_FIELDS);

    if (!sanitized.title || !sanitized.date) {
      return NextResponse.json({ error: 'Title and date are required' }, { status: 400 });
    }

    if (!validateDateString(sanitized.date as string)) {
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

    // Contacts stay owner-only in v1, so an EDITOR may add itinerary items but
    // may not attach a vendor or client to one — those ids resolve against the
    // owner's address book, which the collaborator can neither see nor own.
    if (!access.isOwner && (sanitized.vendorId || sanitized.clientId)) {
      return NextResponse.json(
        { error: 'Only the trip owner can attach vendors or clients' },
        { status: 403 }
      );
    }

    const item = await createItineraryItem({
      tripId: id,
      ...sanitized,
    } as Parameters<typeof createItineraryItem>[0], user.id);
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    if (error instanceof TripAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error creating itinerary item:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to create itinerary item' }, { status: 500 });
  }
}
