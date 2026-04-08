import prisma from '@/lib/prisma';
import type { CreateMeetingInput, UpdateMeetingInput } from './types';

async function verifyTripOwnership(tripId: string, userId: string) {
  const trip = await prisma.trip.findFirst({ where: { id: tripId, userId } });
  if (!trip) throw new Error('Trip not found');
  return trip;
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
  if (data.tripId) await verifyTripOwnership(data.tripId, userId);
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

  if (data.tripId) await verifyTripOwnership(data.tripId, userId);
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
