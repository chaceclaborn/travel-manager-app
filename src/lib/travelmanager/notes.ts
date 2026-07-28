import prisma from '@/lib/prisma';
import { requireTripAccess, TripAccessError } from './trip-access';
import type { CreateTripNoteInput, UpdateTripNoteInput } from './types';

/**
 * Resolve a bare note id to its trip and authorize there.
 *
 * /api/notes/[id] carries no tripId, so without this the flat route would stay
 * the way around the trip-scoped ones. The previous check compared the trip's
 * userId to the caller directly, which could not be widened in place — it only
 * ever had an answer for the owner.
 */
async function requireNoteAccess(noteId: string, userId: string) {
  const note = await prisma.tripNote.findUnique({
    where: { id: noteId },
    select: { tripId: true },
  });
  if (!note) throw new TripAccessError('Note not found', 404);
  return requireTripAccess(note.tripId, userId, 'edit');
}

export async function getTripNotes(tripId: string, userId: string) {
  await requireTripAccess(tripId, userId, 'view');
  return prisma.tripNote.findMany({
    where: { tripId },
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
  });
}

export async function createTripNote(data: CreateTripNoteInput, userId: string) {
  await requireTripAccess(data.tripId, userId, 'edit');
  return prisma.tripNote.create({
    data: {
      date: new Date(data.date),
      content: data.content,
      // Author, not authority — access to the note follows the trip.
      user: { connect: { id: userId } },
      trip: { connect: { id: data.tripId } },
    },
  });
}

export async function updateTripNote(id: string, data: UpdateTripNoteInput, userId: string) {
  await requireNoteAccess(id, userId);
  const updateData: Record<string, unknown> = { ...data };
  if (data.date) updateData.date = new Date(data.date);
  return prisma.tripNote.update({
    where: { id },
    data: updateData,
  });
}

export async function deleteTripNote(id: string, userId: string) {
  await requireNoteAccess(id, userId);
  return prisma.tripNote.delete({ where: { id } });
}
