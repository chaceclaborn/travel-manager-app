import prisma from '@/lib/prisma';
import { requireTripAccess, TripAccessError } from './trip-access';

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

/**
 * Every stop across all of the user's trips — for the global travel map.
 *
 * Deliberately still owner-scoped: stops on trips shared with you do not appear
 * on your map in v1. The map is a "places I have been" rollup, so borrowing
 * someone else's route into it is a product decision rather than a permission
 * one, and widening it here would need tripScopeWhere plus a way to tell the two
 * apart in the UI. Documented gap, not an oversight.
 */
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
  await requireTripAccess(tripId, userId, 'view');
  return prisma.tripStop.findMany({
    where: { tripId },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
}

export async function createStop(data: CreateStopInput, userId: string) {
  await requireTripAccess(data.tripId, userId, 'edit');
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
  await requireTripAccess(tripId, userId, 'edit');
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
  if (result.count === 0) throw new TripAccessError('Stop not found', 404);
  return prisma.tripStop.findUnique({ where: { id: stopId } });
}

/**
 * Delete every stop on a trip (the "clear route" action).
 *
 * 'edit' rather than 'owner' despite being a bulk delete: the route is the whole
 * point of the stops editor and everything it removes an editor could remove one
 * at a time anyway. The bulk-delete routes that stay owner-scoped are the ones
 * that cross trip boundaries.
 */
export async function clearStops(tripId: string, userId: string) {
  await requireTripAccess(tripId, userId, 'edit');
  const result = await prisma.tripStop.deleteMany({ where: { tripId } });
  return result.count;
}

export async function reorderStops(tripId: string, userId: string, orderedIds: string[]) {
  await requireTripAccess(tripId, userId, 'edit');
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
  await requireTripAccess(tripId, userId, 'edit');
  // deleteMany scoped to tripId so a stop id from another trip is a no-op
  const result = await prisma.tripStop.deleteMany({
    where: { id: stopId, tripId },
  });
  if (result.count === 0) throw new TripAccessError('Stop not found', 404);
}
