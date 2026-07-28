import { NextRequest, NextResponse } from 'next/server';
import { getStops, createStop, clearStops, STOP_TRAVEL_MODES } from '@/lib/travelmanager/stops';
import { requireAuth } from '@/lib/travelmanager/auth';
import { requireTripAccess, TripAccessError } from '@/lib/travelmanager/trip-access';
import { rateLimit } from '@/lib/rate-limit';
import { sanitizeObject, validateUUID, validateDateString, validateEnum } from '@/lib/sanitize';

const STOP_ALLOWED_FIELDS = ['name', 'latitude', 'longitude', 'date', 'notes', 'travelMode'];

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

    const stops = await getStops(id, user.id);
    return NextResponse.json(stops);
  } catch (error) {
    if (error instanceof TripAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error fetching stops:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to fetch stops' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const rateLimited = rateLimit(request, 'write');
    if (rateLimited) return rateLimited;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id: tripId } = await params;
    if (!validateUUID(tripId)) {
      return NextResponse.json({ error: 'Invalid trip ID' }, { status: 400 });
    }

    await requireTripAccess(tripId, user.id, 'edit');

    const body = await request.json();
    const sanitized = sanitizeObject(body, STOP_ALLOWED_FIELDS);

    const name = typeof sanitized.name === 'string' ? sanitized.name.trim() : '';
    if (!name || name.length > 200) {
      return NextResponse.json({ error: 'Invalid stop name' }, { status: 400 });
    }

    const latitude = Number(sanitized.latitude);
    const longitude = Number(sanitized.longitude);
    if (
      !Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
      !Number.isFinite(longitude) || longitude < -180 || longitude > 180
    ) {
      return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 });
    }

    if (sanitized.date && !validateDateString(sanitized.date as string)) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
    }

    if (sanitized.travelMode && !validateEnum(sanitized.travelMode as string, STOP_TRAVEL_MODES)) {
      return NextResponse.json({ error: 'Invalid travel mode' }, { status: 400 });
    }

    const stop = await createStop(
      {
        tripId,
        name,
        latitude,
        longitude,
        date: (sanitized.date as string) || null,
        notes: (sanitized.notes as string) || null,
        travelMode: (sanitized.travelMode as string) || null,
      },
      user.id
    );
    return NextResponse.json(stop, { status: 201 });
  } catch (error) {
    if (error instanceof TripAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error creating stop:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to create stop' }, { status: 500 });
  }
}

/** DELETE /api/trips/[id]/stops — clear the whole route for a trip. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const rateLimited = rateLimit(request, 'write');
    if (rateLimited) return rateLimited;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id: tripId } = await params;
    if (!validateUUID(tripId)) {
      return NextResponse.json({ error: 'Invalid trip ID' }, { status: 400 });
    }

    // 'edit', not 'owner': this wipes the route's stops, but stops are ordinary
    // trip content an editor may add and remove one at a time anyway. Only the
    // trip itself is owner-gated.
    await requireTripAccess(tripId, user.id, 'edit');

    const count = await clearStops(tripId, user.id);
    return NextResponse.json({ success: true, deleted: count });
  } catch (error) {
    if (error instanceof TripAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error clearing stops:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to clear stops' }, { status: 500 });
  }
}
