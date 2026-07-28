import { NextRequest, NextResponse } from 'next/server';
import { getBookingById, updateBooking, deleteBooking, linkBookingToTrip } from '@/lib/travelmanager/bookings';
import { requireAuth } from '@/lib/travelmanager/auth';
import {
  requireTripAccess,
  TripAccessError,
  redactBookingForViewer,
  type TripAccess,
  type TripCapability,
} from '@/lib/travelmanager/trip-access';
import { rateLimit } from '@/lib/rate-limit';
import prisma from '@/lib/prisma';
import { sanitizeObject, validateUUID, validateEnum, validateDateString, validateTimezone, BOOKING_TYPE_VALUES } from '@/lib/sanitize';

const BOOKING_ALLOWED_FIELDS = ['tripId', 'type', 'status', 'provider', 'confirmationNum', 'startDateTime', 'endDateTime', 'location', 'endLocation', 'seat', 'notes', 'commissionAmount', 'commissionRate', 'commissionPaid', 'commissionNotes', 'timezone'];
const BOOKING_STATUS_VALUES = ['ACTIVE', 'CANCELLED'] as const;

/**
 * Booking is the one child whose tripId is nullable — a standalone booking has
 * no trip to derive permission from, so it falls back to its own userId. Once
 * it is attached to a trip the trip is the authority, and `userId` means only
 * "who entered it": a collaborator may edit a booking the owner typed, and the
 * owner may edit one a collaborator typed.
 *
 * Returns the TripAccess when a trip decided it, null when the row's own userId
 * did — callers need that distinction to know whether to redact commissions.
 */
async function authorizeBooking(
  bookingId: string,
  userId: string,
  need: Extract<TripCapability, 'view' | 'edit'>
): Promise<{ access: TripAccess | null } | { notFound: true }> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { tripId: true, userId: true },
  });
  if (!booking) return { notFound: true };
  if (booking.tripId) {
    return { access: await requireTripAccess(booking.tripId, userId, need) };
  }
  if (booking.userId !== userId) return { notFound: true };
  return { access: null };
}

/**
 * A collaborator is served the commission columns as null, so echoing the form
 * back on save would blank out the owner's real figures. Dropping the keys
 * entirely leaves the stored values untouched — a write the collaborator never
 * saw must not be a write they can destroy.
 */
function dropCommissionFieldsForNonOwner(
  sanitized: Record<string, unknown>,
  access: TripAccess | null
) {
  if (!access || access.isOwner) return;
  delete sanitized.commissionAmount;
  delete sanitized.commissionRate;
  delete sanitized.commissionPaid;
  delete sanitized.commissionNotes;
}

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
    const authorized = await authorizeBooking(id, user.id, 'view');
    if ('notFound' in authorized) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const booking = await getBookingById(id, user.id);
    // Commission fields are the owner's agency earnings, never a collaborator's
    // business, and the query has no select to keep them out.
    return NextResponse.json(
      authorized.access ? redactBookingForViewer(booking, authorized.access) : booking
    );
  } catch (error) {
    if (error instanceof TripAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
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

    const authorized = await authorizeBooking(id, user.id, 'edit');
    if ('notFound' in authorized) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const body = await request.json();
    const sanitized = sanitizeObject(body, BOOKING_ALLOWED_FIELDS);

    if (sanitized.type && !validateEnum(sanitized.type as string, BOOKING_TYPE_VALUES)) {
      return NextResponse.json({ error: 'Invalid booking type' }, { status: 400 });
    }

    if (sanitized.status && !validateEnum(sanitized.status as string, BOOKING_STATUS_VALUES)) {
      return NextResponse.json({ error: 'Invalid booking status' }, { status: 400 });
    }

    if (sanitized.startDateTime && !validateDateString(sanitized.startDateTime as string)) {
      return NextResponse.json({ error: 'Invalid start date format' }, { status: 400 });
    }

    if (sanitized.endDateTime && !validateDateString(sanitized.endDateTime as string)) {
      return NextResponse.json({ error: 'Invalid end date format' }, { status: 400 });
    }

    if (!validateTimezone(sanitized.timezone as string | null | undefined)) {
      return NextResponse.json({ error: 'Invalid timezone' }, { status: 400 });
    }

    // Commission numeric coercion + validation
    if (sanitized.commissionAmount !== undefined && sanitized.commissionAmount !== null && sanitized.commissionAmount !== '') {
      const amt = Number(sanitized.commissionAmount);
      if (!Number.isFinite(amt) || amt < 0) {
        return NextResponse.json({ error: 'Invalid commission amount' }, { status: 400 });
      }
      sanitized.commissionAmount = amt;
    }

    if (sanitized.commissionRate !== undefined && sanitized.commissionRate !== null && sanitized.commissionRate !== '') {
      const rate = Number(sanitized.commissionRate);
      if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
        return NextResponse.json({ error: 'Invalid commission rate (must be 0-100)' }, { status: 400 });
      }
      sanitized.commissionRate = rate;
    }

    if (sanitized.commissionPaid !== undefined) {
      if (typeof sanitized.commissionPaid === 'boolean') {
        // already clean
      } else if (sanitized.commissionPaid === 'true') {
        sanitized.commissionPaid = true;
      } else if (sanitized.commissionPaid === 'false') {
        sanitized.commissionPaid = false;
      } else {
        return NextResponse.json({ error: 'Invalid commission paid status' }, { status: 400 });
      }
    }

    dropCommissionFieldsForNonOwner(sanitized, authorized.access);

    // Trip reassignment must go through PATCH -> linkBookingToTrip, which
    // verifies the caller owns the TARGET trip. Passing tripId straight into
    // updateBooking would let a user attach their booking to someone else's
    // trip (tenant-isolation hole found in the 2026-07-09 audit).
    delete sanitized.tripId;

    const booking = await updateBooking(id, sanitized as Parameters<typeof updateBooking>[1], user.id);
    return NextResponse.json(
      authorized.access ? redactBookingForViewer(booking, authorized.access) : booking
    );
  } catch (error) {
    if (error instanceof TripAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
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

    const authorized = await authorizeBooking(id, user.id, 'edit');
    if ('notFound' in authorized) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const body = await request.json();
    const sanitized = sanitizeObject(body, BOOKING_ALLOWED_FIELDS);

    if (sanitized.type && !validateEnum(sanitized.type as string, BOOKING_TYPE_VALUES)) {
      return NextResponse.json({ error: 'Invalid booking type' }, { status: 400 });
    }

    if (sanitized.status && !validateEnum(sanitized.status as string, BOOKING_STATUS_VALUES)) {
      return NextResponse.json({ error: 'Invalid booking status' }, { status: 400 });
    }

    if (sanitized.startDateTime && !validateDateString(sanitized.startDateTime as string)) {
      return NextResponse.json({ error: 'Invalid start date format' }, { status: 400 });
    }

    if (sanitized.endDateTime && !validateDateString(sanitized.endDateTime as string)) {
      return NextResponse.json({ error: 'Invalid end date format' }, { status: 400 });
    }

    if (!validateTimezone(sanitized.timezone as string | null | undefined)) {
      return NextResponse.json({ error: 'Invalid timezone' }, { status: 400 });
    }

    // Commission numeric coercion + validation
    if (sanitized.commissionAmount !== undefined && sanitized.commissionAmount !== null && sanitized.commissionAmount !== '') {
      const amt = Number(sanitized.commissionAmount);
      if (!Number.isFinite(amt) || amt < 0) {
        return NextResponse.json({ error: 'Invalid commission amount' }, { status: 400 });
      }
      sanitized.commissionAmount = amt;
    }

    if (sanitized.commissionRate !== undefined && sanitized.commissionRate !== null && sanitized.commissionRate !== '') {
      const rate = Number(sanitized.commissionRate);
      if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
        return NextResponse.json({ error: 'Invalid commission rate (must be 0-100)' }, { status: 400 });
      }
      sanitized.commissionRate = rate;
    }

    if (sanitized.commissionPaid !== undefined) {
      if (typeof sanitized.commissionPaid === 'boolean') {
        // already clean
      } else if (sanitized.commissionPaid === 'true') {
        sanitized.commissionPaid = true;
      } else if (sanitized.commissionPaid === 'false') {
        sanitized.commissionPaid = false;
      } else {
        return NextResponse.json({ error: 'Invalid commission paid status' }, { status: 400 });
      }
    }

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
