import prisma from '@/lib/prisma';

async function verifyTripOwnership(tripId: string, userId: string) {
  const trip = await prisma.trip.findFirst({ where: { id: tripId, userId } });
  if (!trip) throw new Error('Trip not found');
  return trip;
}

export const STOP_TRAVEL_MODES = ['drive', 'flight', 'train', 'bus', 'boat', 'walk'] as const;
export type StopTravelMode = (typeof STOP_TRAVEL_MODES)[number];

export interface CreateStopInput {
  tripId: string;
  name: string;
  latitude: number;
  longitude: number;
  date?: string | null;
  notes?: string | null;
  travelMode?: string | null;
}

export interface UpdateStopInput {
  name?: string;
  date?: string | null;
  notes?: string | null;
  travelMode?: string | null;
}

/** Every stop across all of the user's trips — for the global travel map. */
export async function getAllStops(userId: string) {
  return prisma.tripStop.findMany({
    where: { trip: { userId } },
    orderBy: [{ tripId: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      tripId: true,
      name: true,
      latitude: true,
      longitude: true,
      travelMode: true,
      sortOrder: true,
    },
  });
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
      travelMode: data.travelMode ?? null,
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
  });
}

export async function updateStop(
  stopId: string,
  tripId: string,
  userId: string,
  data: UpdateStopInput
) {
  await verifyTripOwnership(tripId, userId);
  // updateMany scoped to tripId so a stop id from another trip is a no-op
  const result = await prisma.tripStop.updateMany({
    where: { id: stopId, tripId },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.date !== undefined ? { date: data.date ? new Date(data.date) : null } : {}),
      ...(data.notes !== undefined ? { notes: data.notes } : {}),
      ...(data.travelMode !== undefined ? { travelMode: data.travelMode } : {}),
    },
  });
  if (result.count === 0) throw new Error('Stop not found');
  return prisma.tripStop.findUnique({ where: { id: stopId } });
}

/** Delete every stop on a trip (the "clear route" action). */
export async function clearStops(tripId: string, userId: string) {
  await verifyTripOwnership(tripId, userId);
  const result = await prisma.tripStop.deleteMany({ where: { tripId } });
  return result.count;
}

export async function reorderStops(tripId: string, userId: string, orderedIds: string[]) {
  await verifyTripOwnership(tripId, userId);
  // Verify all ids belong to this trip (prevents cross-trip reordering)
  const existing = await prisma.tripStop.findMany({
    where: { id: { in: orderedIds }, tripId },
    select: { id: true },
  });
  if (existing.length !== orderedIds.length) {
    throw new Error('Some stops do not belong to this trip');
  }
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.tripStop.update({ where: { id }, data: { sortOrder: index } })
    )
  );
}

export async function deleteStop(stopId: string, tripId: string, userId: string) {
  await verifyTripOwnership(tripId, userId);
  // deleteMany scoped to tripId so a stop id from another trip is a no-op
  const result = await prisma.tripStop.deleteMany({
    where: { id: stopId, tripId },
  });
  if (result.count === 0) throw new Error('Stop not found');
}
