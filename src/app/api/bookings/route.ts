import { NextRequest, NextResponse } from 'next/server';
import { getMyBookings, createBooking } from '@/lib/travelmanager/bookings';
import { requireAuth } from '@/lib/travelmanager/auth';
import { rateLimit } from '@/lib/rate-limit';
import { sanitizeObject, validateEnum, validateUUID, validateDateString, BOOKING_TYPE_VALUES } from '@/lib/sanitize';

const BOOKING_ALLOWED_FIELDS = ['tripId', 'type', 'provider', 'confirmationNum', 'startDateTime', 'endDateTime', 'location', 'endLocation', 'seat', 'notes'];

export async function GET(request: NextRequest) {
  try {
    const rateLimitResult = rateLimit(request, 'read');
    if (rateLimitResult) return rateLimitResult;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const bookings = await getMyBookings(user.id);
    return NextResponse.json(bookings);
  } catch (error) {
    console.error('Error fetching bookings:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to fetch bookings' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const rateLimitResult = rateLimit(request, 'write');
    if (rateLimitResult) return rateLimitResult;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const body = await request.json();
    const sanitized = sanitizeObject(body, BOOKING_ALLOWED_FIELDS);

    if (!sanitized.provider || !sanitized.type) {
      return NextResponse.json({ error: 'Provider and type are required' }, { status: 400 });
    }

    if (!validateEnum(sanitized.type as string, BOOKING_TYPE_VALUES)) {
      return NextResponse.json({ error: 'Invalid booking type' }, { status: 400 });
    }

    if (sanitized.tripId && !validateUUID(sanitized.tripId as string)) {
      return NextResponse.json({ error: 'Invalid trip ID' }, { status: 400 });
    }

    if (sanitized.startDateTime && !validateDateString(sanitized.startDateTime as string)) {
      return NextResponse.json({ error: 'Invalid start date format' }, { status: 400 });
    }

    if (sanitized.endDateTime && !validateDateString(sanitized.endDateTime as string)) {
      return NextResponse.json({ error: 'Invalid end date format' }, { status: 400 });
    }

    const booking = await createBooking(sanitized as unknown as Parameters<typeof createBooking>[0], user.id);
    return NextResponse.json(booking, { status: 201 });
  } catch (error) {
    console.error('Error creating booking:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to create booking' }, { status: 500 });
  }
}
