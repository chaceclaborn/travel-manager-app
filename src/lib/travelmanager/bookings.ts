import { after } from 'next/server';
import prisma from '@/lib/prisma';
import { notifyBookingConfirmed } from '@/lib/push/dispatch';
import {
  requireTripAccess,
  redactBookingForViewer,
  redactBookingsForViewer,
  TripAccessError,
  type TripAccess,
  type TripCapability,
} from './trip-access';
import type { CreateBookingInput, UpdateBookingInput } from './types';

/**
 * Booking.tripId is nullable — a booking can live on its own in someone's
 * personal list with no trip attached at all. That makes this the one child
 * model with two possible authorities, so resolve them in one place:
 *
 * - attached to a trip: the TRIP decides, always. The author may be a
 *   collaborator, and the trip owner must still be able to manage every row
 *   sitting on their own trip.
 * - no trip: the row belongs to exactly one person, so authorship decides.
 *
 * Returns the access record the redaction helpers take, so callers can hand
 * the result straight to redactBookingForViewer.
 */
async function authorizeBooking(
  booking: { tripId: string | null; userId: string },
  userId: string,
  need: Exclude<TripCapability, 'owner'>
): Promise<Pick<TripAccess, 'isOwner'>> {
  if (booking.tripId) return requireTripAccess(booking.tripId, userId, need);
  if (booking.userId !== userId) throw new TripAccessError('Booking not found', 404);
  return { isOwner: true };
}

export async function getBookings(tripId: string, userId: string) {
  const access = await requireTripAccess(tripId, userId, 'view');
  const bookings = await prisma.booking.findMany({
    where: { tripId },
    orderBy: { startDateTime: 'asc' },
  });
  return redactBookingsForViewer(bookings, access);
}

export async function getMyBookings(userId: string) {
  return prisma.booking.findMany({
    where: {
      userId,
      // userId now means AUTHOR, so this filter alone would pull a collaborator's
      // contributions to other people's trips into their private list. This is a
      // "my stuff" rollup: it stays the user's own trips plus their untethered
      // bookings.
      OR: [{ tripId: null }, { trip: { userId } }],
    },
    include: { trip: { select: { id: true, title: true, destination: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getBookingById(id: string, userId: string) {
  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) throw new TripAccessError('Booking not found', 404);
  const access = await authorizeBooking(booking, userId, 'view');
  return redactBookingForViewer(booking, access);
}

export async function createBooking(data: CreateBookingInput, userId: string) {
  const access = data.tripId
    ? await requireTripAccess(data.tripId, userId, 'edit')
    : { isOwner: true };
  const booking = await prisma.booking.create({
    data: {
      type: data.type,
      provider: data.provider,
      confirmationNum: data.confirmationNum,
      startDateTime: data.startDateTime || null,
      endDateTime: data.endDateTime || null,
      timezone: data.timezone ?? null,
      location: data.location,
      endLocation: data.endLocation,
      seat: data.seat,
      notes: data.notes,
      commissionAmount: data.commissionAmount ?? null,
      commissionRate: data.commissionRate ?? null,
      commissionPaid: data.commissionPaid ?? false,
      commissionNotes: data.commissionNotes ?? null,
      ...(data.tripId ? { trip: { connect: { id: data.tripId } } } : {}),
      user: { connect: { id: userId } },
    },
  });

  // "Booking confirmed" push to the author's own devices — the trip owner is
  // deliberately not pushed here, because a collaborator saving child rows would
  // otherwise notify the owner on every single save. Runs AFTER the response is
  // sent (never adds APNs latency to the save); no-op when APNs isn't
  // configured; never throws. after() requires a request scope — outside one
  // (unit tests, scripts) fall back to fire-and-forget.
  const fireConfirmation = () =>
    notifyBookingConfirmed({
      userId,
      type: booking.type,
      provider: booking.provider,
      confirmationNum: booking.confirmationNum,
      tripId: booking.tripId,
    });
  try {
    after(fireConfirmation);
  } catch {
    void fireConfirmation();
  }

  return redactBookingForViewer(booking, access);
}

export async function updateBooking(id: string, data: UpdateBookingInput, userId: string) {
  const booking = await prisma.booking.findUnique({ where: { id }, select: { tripId: true, userId: true } });
  if (!booking) throw new TripAccessError('Booking not found', 404);
  const access = await authorizeBooking(booking, userId, 'edit');

  const updateData: Record<string, unknown> = { ...data };
  if (data.startDateTime !== undefined) updateData.startDateTime = data.startDateTime || null;
  if (data.endDateTime !== undefined) updateData.endDateTime = data.endDateTime || null;

  const updated = await prisma.booking.update({
    where: { id },
    data: updateData,
  });
  return redactBookingForViewer(updated, access);
}

export async function linkBookingToTrip(bookingId: string, tripId: string, userId: string) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, select: { tripId: true, userId: true } });
  if (!booking) throw new TripAccessError('Booking not found', 404);
  // A move is authorized at both ends. Leaving: whatever authority the booking
  // has today. Arriving: 'edit' on the target trip — that check is the
  // 2026-07-09 tenant-isolation fix and must stay, or anyone could staple a
  // booking onto a stranger's trip.
  await authorizeBooking(booking, userId, 'edit');
  const access = await requireTripAccess(tripId, userId, 'edit');
  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: { tripId },
  });
  return redactBookingForViewer(updated, access);
}

export async function deleteBooking(id: string, userId: string) {
  const booking = await prisma.booking.findUnique({ where: { id }, select: { tripId: true, userId: true } });
  if (!booking) throw new TripAccessError('Booking not found', 404);
  const access = await authorizeBooking(booking, userId, 'edit');
  const deleted = await prisma.booking.delete({ where: { id } });
  return redactBookingForViewer(deleted, access);
}
