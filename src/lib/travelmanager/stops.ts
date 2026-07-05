import prisma from '@/lib/prisma';

async function verifyTripOwnership(tripId: string, userId: string) {
  const trip = await prisma.trip.findFirst({ where: { id: tripId, userId } });
  if (!trip) throw new Error('Trip not found');
  return trip;
}

export interface CreateStopInput {
  tripId: string;
  name: string;
  latitude: number;
  longitude: number;
  date?: string | null;
  notes?: string | null;
}

export async function getStops(tripId: string, userId: string) {
  await verifyTripOwnership(tripId, userId);
  return prisma.tripStop.findMany({
    where: { tripId },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
}

export async function createStop(data: CreateStopInput, userId: string) {
  await verifyTripOwnership(data.tripId, userId);
  const last = await prisma.tripStop.findFirst({
    where: { tripId: data.tripId },
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  });
  return prisma.tripStop.create({
    data: {
      trip: { connect: { id: data.tripId } },
      name: data.name,
      latitude: data.latitude,
      longitude: data.longitude,
      date: data.date ? new Date(data.date) : null,
      notes: data.notes ?? null,
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
  });
}

export async function deleteStop(stopId: string, tripId: string, userId: string) {
  await verifyTripOwnership(tripId, userId);
  // deleteMany scoped to tripId so a stop id from another trip is a no-op
  const result = await prisma.tripStop.deleteMany({
    where: { id: stopId, tripId },
  });
  if (result.count === 0) throw new Error('Stop not found');
}
