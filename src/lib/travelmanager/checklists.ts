import prisma from '@/lib/prisma';
import type { CreateChecklistItemInput, UpdateChecklistItemInput } from './types';

async function verifyTripOwnership(tripId: string, userId: string) {
  const trip = await prisma.trip.findFirst({ where: { id: tripId, userId } });
  if (!trip) throw new Error('Trip not found');
  return trip;
}

export async function getChecklistItems(tripId: string, userId: string) {
  await verifyTripOwnership(tripId, userId);
  return prisma.checklistItem.findMany({
    where: { tripId },
    orderBy: { sortOrder: 'asc' },
  });
}

export async function createChecklistItem(data: CreateChecklistItemInput, userId: string) {
  await verifyTripOwnership(data.tripId, userId);
  return prisma.checklistItem.create({
    data: {
      label: data.label,
      sortOrder: data.sortOrder ?? 0,
      trip: { connect: { id: data.tripId } },
      user: { connect: { id: userId } },
    },
  });
}

export async function updateChecklistItem(id: string, data: UpdateChecklistItemInput, userId: string) {
  const item = await prisma.checklistItem.findUnique({ where: { id }, select: { tripId: true } });
  if (!item) throw new Error('Checklist item not found');
  await verifyTripOwnership(item.tripId, userId);
  return prisma.checklistItem.update({
    where: { id },
    data,
  });
}

export async function deleteChecklistItem(id: string, userId: string) {
  const item = await prisma.checklistItem.findUnique({ where: { id }, select: { tripId: true } });
  if (!item) throw new Error('Checklist item not found');
  await verifyTripOwnership(item.tripId, userId);
  return prisma.checklistItem.delete({ where: { id } });
}
