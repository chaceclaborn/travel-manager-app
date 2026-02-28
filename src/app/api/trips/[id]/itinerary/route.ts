import { NextRequest, NextResponse } from 'next/server';
import { getTripItinerary, createItineraryItem } from '@/lib/travelmanager/trips';
import { requireAuth } from '@/lib/travelmanager/auth';
import { sanitizeObject, validateUUID, validateDateString } from '@/lib/sanitize';

const ITINERARY_ALLOWED_FIELDS = ['title', 'date', 'endDate', 'startTime', 'endTime', 'location', 'notes', 'sortOrder', 'vendorId', 'clientId'];

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id } = await params;
    if (!validateUUID(id)) {
      return NextResponse.json({ error: 'Invalid trip ID' }, { status: 400 });
    }
    const itinerary = await getTripItinerary(id, user.id);
    return NextResponse.json(itinerary);
  } catch (error) {
    console.error('Error fetching itinerary:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to fetch itinerary' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id } = await params;
    if (!validateUUID(id)) {
      return NextResponse.json({ error: 'Invalid trip ID' }, { status: 400 });
    }

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

    const item = await createItineraryItem({
      tripId: id,
      ...sanitized,
    } as Parameters<typeof createItineraryItem>[0], user.id);
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error('Error creating itinerary item:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to create itinerary item' }, { status: 500 });
  }
}
