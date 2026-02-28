import { NextRequest, NextResponse } from 'next/server';
import { getBookingById, updateBooking, deleteBooking, linkBookingToTrip } from '@/lib/travelmanager/bookings';
import { requireAuth } from '@/lib/travelmanager/auth';
import { rateLimit } from '@/lib/rate-limit';
import { sanitizeObject, validateUUID, validateEnum, validateDateString, BOOKING_TYPE_VALUES } from '@/lib/sanitize';

const BOOKING_ALLOWED_FIELDS = ['tripId', 'type', 'provider', 'confirmationNum', 'startDateTime', 'endDateTime', 'location', 'endLocation', 'seat', 'notes'];

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const rateLimited = rateLimit(request, 'read');
    if (rateLimited) return rateLimited;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id } = await params;
    if (!validateUUID(id)) {
      return NextResponse.json({ error: 'Invalid booking ID' }, { status: 400 });
    }
    const booking = await getBookingById(id, user.id);
    return NextResponse.json(booking);
  } catch (error) {
    console.error('Error fetching booking:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to fetch booking' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const rateLimited = rateLimit(request, 'write');
    if (rateLimited) return rateLimited;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id } = await params;
    if (!validateUUID(id)) {
      return NextResponse.json({ error: 'Invalid booking ID' }, { status: 400 });
    }

    const body = await request.json();
    const sanitized = sanitizeObject(body, BOOKING_ALLOWED_FIELDS);

    if (sanitized.type && !validateEnum(sanitized.type as string, BOOKING_TYPE_VALUES)) {
      return NextResponse.json({ error: 'Invalid booking type' }, { status: 400 });
    }

    if (sanitized.startDateTime && !validateDateString(sanitized.startDateTime as string)) {
      return NextResponse.json({ error: 'Invalid start date format' }, { status: 400 });
    }

    if (sanitized.endDateTime && !validateDateString(sanitized.endDateTime as string)) {
      return NextResponse.json({ error: 'Invalid end date format' }, { status: 400 });
    }

    const booking = await updateBooking(id, sanitized as Parameters<typeof updateBooking>[1], user.id);
    return NextResponse.json(booking);
  } catch (error) {
    console.error('Error updating booking:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to update booking' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const rateLimited = rateLimit(request, 'write');
    if (rateLimited) return rateLimited;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id } = await params;
    if (!validateUUID(id)) {
      return NextResponse.json({ error: 'Invalid booking ID' }, { status: 400 });
    }

    const body = await request.json();
    const sanitized = sanitizeObject(body, BOOKING_ALLOWED_FIELDS);

    if (sanitized.tripId) {
      if (!validateUUID(sanitized.tripId as string)) {
        return NextResponse.json({ error: 'Invalid trip ID' }, { status: 400 });
      }
      const booking = await linkBookingToTrip(id, sanitized.tripId as string, user.id);
      return NextResponse.json(booking);
    }

    const booking = await updateBooking(id, sanitized as Parameters<typeof updateBooking>[1], user.id);
    return NextResponse.json(booking);
  } catch (error) {
    console.error('Error updating booking:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to update booking' }, { status: 500 });
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
      return NextResponse.json({ error: 'Invalid booking ID' }, { status: 400 });
    }
    await deleteBooking(id, user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting booking:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to delete booking' }, { status: 500 });
  }
}
