import prisma from '@/lib/prisma';
import { requireTripAccess } from './trip-access';
import type { CreateMeetingInput, UpdateMeetingInput } from './types';

/**
 * Meetings are the one trip child that does not become collaborative.
 *
 * Every other child is authorized by its trip, so widening the trip widens the
 * child. A Meeting is authorized purely by meeting.userId, and its trip relation
 * is onDelete: SetNull — so it is the only child that outlives the trip it was
 * attached to. A collaborator attaching a meeting would therefore create a row on
 * the owner's trip that the owner can neither read nor delete, and that survives
 * them deleting the trip entirely. Requiring 'owner' to attach keeps the meeting's
 * two authorities — its userId and its tripId — pointing at the same person.
 *
 * Reads stay narrow for the same reason: getMyMeetings and getMeetingById filter
 * on userId alone, so there is nothing to widen without giving meetings a second
 * access model.
 */
async function requireMeetingTripOwner(tripId: string, userId: string) {
  return requireTripAccess(tripId, userId, 'owner');
}

async function verifyClientOwnership(clientId: string, userId: string) {
  const client = await prisma.client.findFirst({ where: { id: clientId, userId } });
  if (!client) throw new Error('Client not found');
  return client;
}

export async function getMyMeetings(userId: string) {
  return prisma.meeting.findMany({
    where: { userId },
    include: {
      trip: { select: { id: true, title: true, destination: true } },
      client: { select: { id: true, name: true, company: true } },
    },
    orderBy: { startDateTime: 'desc' },
  });
}

export async function getMeetingById(id: string, userId: string) {
  const meeting = await prisma.meeting.findUnique({
    where: { id },
    include: {
      trip: { select: { id: true, title: true, destination: true } },
      client: { select: { id: true, name: true, company: true } },
    },
  });
  if (!meeting || meeting.userId !== userId) throw new Error('Meeting not found');
  return meeting;
}

export async function createMeeting(data: CreateMeetingInput, userId: string) {
  if (data.tripId) await requireMeetingTripOwner(data.tripId, userId);
  if (data.clientId) await verifyClientOwnership(data.clientId, userId);

  return prisma.meeting.create({
    data: {
      title: data.title,
      startDateTime: data.startDateTime,
      endDateTime: data.endDateTime ?? null,
      timezone: data.timezone ?? null,
      location: data.location ?? null,
      notes: data.notes ?? null,
      ...(data.tripId ? { trip: { connect: { id: data.tripId } } } : {}),
      ...(data.clientId ? { client: { connect: { id: data.clientId } } } : {}),
      user: { connect: { id: userId } },
    },
  });
}

export async function updateMeeting(id: string, data: UpdateMeetingInput, userId: string) {
  const existing = await prisma.meeting.findUnique({ where: { id }, select: { userId: true } });
  if (!existing || existing.userId !== userId) throw new Error('Meeting not found');

  if (data.tripId) await requireMeetingTripOwner(data.tripId, userId);
  if (data.clientId) await verifyClientOwnership(data.clientId, userId);

  const updateData: Record<string, unknown> = {};
  if (data.title !== undefined) updateData.title = data.title;
  if (data.startDateTime !== undefined) updateData.startDateTime = data.startDateTime;
  if (data.endDateTime !== undefined) updateData.endDateTime = data.endDateTime || null;
  if (data.timezone !== undefined) updateData.timezone = data.timezone || null;
  if (data.location !== undefined) updateData.location = data.location;
  if (data.notes !== undefined) updateData.notes = data.notes;
  if (data.tripId !== undefined) updateData.tripId = data.tripId || null;
  if (data.clientId !== undefined) updateData.clientId = data.clientId || null;

  return prisma.meeting.update({ where: { id }, data: updateData });
}

export async function deleteMeeting(id: string, userId: string) {
  const existing = await prisma.meeting.findUnique({ where: { id }, select: { userId: true } });
  if (!existing || existing.userId !== userId) throw new Error('Meeting not found');
  return prisma.meeting.delete({ where: { id } });
}
