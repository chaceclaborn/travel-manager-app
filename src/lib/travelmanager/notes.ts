import prisma from '@/lib/prisma';
import type { CreateTripNoteInput, UpdateTripNoteInput } from './types';

async function verifyTripOwnership(tripId: string, userId: string) {
  const trip = await prisma.trip.findFirst({ where: { id: tripId, userId } });
  if (!trip) throw new Error('Trip not found');
  return trip;
}

async function verifyNoteOwnership(noteId: string, userId: string) {
  const note = await prisma.tripNote.findUnique({
    where: { id: noteId },
    select: { tripId: true, trip: { select: { userId: true } } },
  });
  if (!note || note.trip.userId !== userId) throw new Error('Note not found');
  return note;
}

export async function getTripNotes(tripId: string, userId: string) {
  await verifyTripOwnership(tripId, userId);
  return prisma.tripNote.findMany({
    where: { tripId },
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
  });
}

export async function createTripNote(data: CreateTripNoteInput, userId: string) {
  await verifyTripOwnership(data.tripId, userId);
  return prisma.tripNote.create({
    data: {
      date: new Date(data.date),
      content: data.content,
      user: { connect: { id: userId } },
      trip: { connect: { id: data.tripId } },
    },
  });
}

export async function updateTripNote(id: string, data: UpdateTripNoteInput, userId: string) {
  await verifyNoteOwnership(id, userId);
  const updateData: Record<string, unknown> = { ...data };
  if (data.date) updateData.date = new Date(data.date);
  return prisma.tripNote.update({
    where: { id },
    data: updateData,
  });
}

export async function deleteTripNote(id: string, userId: string) {
  await verifyNoteOwnership(id, userId);
  return prisma.tripNote.delete({ where: { id } });
}
