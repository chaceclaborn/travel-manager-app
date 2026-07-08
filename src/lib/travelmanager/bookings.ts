import { after } from 'next/server';
import prisma from '@/lib/prisma';
import { notifyBookingConfirmed } from '@/lib/push/dispatch';
import type { CreateBookingInput, UpdateBookingInput } from './types';

async function verifyTripOwnership(tripId: string, userId: string) {
  const trip = await prisma.trip.findFirst({ where: { id: tripId, userId } });
  if (!trip) throw new Error('Trip not found');
  return trip;
}

export async function getBookings(tripId: string, userId: string) {
  await verifyTripOwnership(tripId, userId);
  return prisma.booking.findMany({
    where: { tripId },
    orderBy: { startDateTime: 'asc' },
  });
}

export async function getMyBookings(userId: string) {
  return prisma.booking.findMany({
    where: { userId },
    include: { trip: { select: { id: true, title: true, destination: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getBookingById(id: string, userId: string) {
  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) throw new Error('Booking not found');
  if (booking.tripId) {
    await verifyTripOwnership(booking.tripId, userId);
  } else if (booking.userId !== userId) {
    throw new Error('Booking not found');
  }
  return booking;
}

export async function createBooking(data: CreateBookingInput, userId: string) {
  if (data.tripId) {
    await verifyTripOwnership(data.tripId, userId);
  }
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

  // "Booking confirmed" push to the owner's devices. Runs AFTER the response
  // is sent (never adds APNs latency to the save); no-op when APNs isn't
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

  return booking;
}

export async function updateBooking(id: string, data: UpdateBookingInput, userId: string) {
  const booking = await prisma.booking.findUnique({ where: { id }, select: { tripId: true, userId: true } });
  if (!booking) throw new Error('Booking not found');
  if (booking.tripId) {
    await verifyTripOwnership(booking.tripId, userId);
  } else if (booking.userId !== userId) {
    throw new Error('Booking not found');
  }

  const updateData: Record<string, unknown> = { ...data };
  if (data.startDateTime !== undefined) updateData.startDateTime = data.startDateTime || null;
  if (data.endDateTime !== undefined) updateData.endDateTime = data.endDateTime || null;

  return prisma.booking.update({
    where: { id },
    data: updateData,
  });
}

export async function linkBookingToTrip(bookingId: string, tripId: string, userId: string) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, select: { userId: true } });
  if (!booking || booking.userId !== userId) throw new Error('Booking not found');
  await verifyTripOwnership(tripId, userId);
  return prisma.booking.update({
    where: { id: bookingId },
    data: { tripId },
  });
}

export async function deleteBooking(id: string, userId: string) {
  const booking = await prisma.booking.findUnique({ where: { id }, select: { tripId: true, userId: true } });
  if (!booking) throw new Error('Booking not found');
  if (booking.tripId) {
    await verifyTripOwnership(booking.tripId, userId);
  } else if (booking.userId !== userId) {
    throw new Error('Booking not found');
  }
  return prisma.booking.delete({ where: { id } });
}
