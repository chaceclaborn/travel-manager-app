import prisma from '@/lib/prisma';
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

export async function getBookingById(id: string, userId: string) {
  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) throw new Error('Booking not found');
  await verifyTripOwnership(booking.tripId, userId);
  return booking;
}

export async function createBooking(data: CreateBookingInput, userId: string) {
  await verifyTripOwnership(data.tripId, userId);
  return prisma.booking.create({
    data: {
      type: data.type,
      provider: data.provider,
      confirmationNum: data.confirmationNum,
      startDateTime: data.startDateTime || null,
      endDateTime: data.endDateTime || null,
      location: data.location,
      endLocation: data.endLocation,
      seat: data.seat,
      notes: data.notes,
      trip: { connect: { id: data.tripId } },
      user: { connect: { id: userId } },
    },
  });
}

export async function updateBooking(id: string, data: UpdateBookingInput, userId: string) {
  const booking = await prisma.booking.findUnique({ where: { id }, select: { tripId: true } });
  if (!booking) throw new Error('Booking not found');
  await verifyTripOwnership(booking.tripId, userId);

  const updateData: Record<string, unknown> = { ...data };
  if (data.startDateTime !== undefined) updateData.startDateTime = data.startDateTime || null;
  if (data.endDateTime !== undefined) updateData.endDateTime = data.endDateTime || null;

  return prisma.booking.update({
    where: { id },
    data: updateData,
  });
}

export async function deleteBooking(id: string, userId: string) {
  const booking = await prisma.booking.findUnique({ where: { id }, select: { tripId: true } });
  if (!booking) throw new Error('Booking not found');
  await verifyTripOwnership(booking.tripId, userId);
  return prisma.booking.delete({ where: { id } });
}
