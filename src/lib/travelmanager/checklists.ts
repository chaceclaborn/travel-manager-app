import prisma from '@/lib/prisma';
import { requireTripAccess, TripAccessError } from './trip-access';
import type { CreateChecklistItemInput, UpdateChecklistItemInput } from './types';

export async function getChecklistItems(tripId: string, userId: string) {
  await requireTripAccess(tripId, userId, 'view');
  return prisma.checklistItem.findMany({
    where: { tripId },
    orderBy: { sortOrder: 'asc' },
  });
}

export async function createChecklistItem(data: CreateChecklistItemInput, userId: string) {
  await requireTripAccess(data.tripId, userId, 'edit');
  return prisma.checklistItem.create({
    data: {
      label: data.label,
      sortOrder: data.sortOrder ?? 0,
      trip: { connect: { id: data.tripId } },
      // userId records the author, not the authority — the trip is what grants
      // access, so a collaborator's item stays readable and deletable by the owner.
      user: { connect: { id: userId } },
    },
  });
}

export async function updateChecklistItem(id: string, data: UpdateChecklistItemInput, userId: string) {
  await requireItemAccess(id, userId);
  return prisma.checklistItem.update({
    where: { id },
    data,
  });
}

export async function deleteChecklistItem(id: string, userId: string) {
  await requireItemAccess(id, userId);
  return prisma.checklistItem.delete({ where: { id } });
}

/**
 * Resolve a bare checklist-item id to its trip and authorize there.
 *
 * /api/checklists/[id] carries no tripId, which makes it the obvious way around
 * the trip-scoped routes; the item's own row is the only thing that can point at
 * the trip that actually governs it.
 */
async function requireItemAccess(id: string, userId: string) {
  const item = await prisma.checklistItem.findUnique({ where: { id }, select: { tripId: true } });
  if (!item) throw new TripAccessError('Checklist item not found', 404);
  return requireTripAccess(item.tripId, userId, 'edit');
}
