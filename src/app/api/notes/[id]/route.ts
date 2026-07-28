import { NextRequest, NextResponse } from 'next/server';
import { updateTripNote, deleteTripNote } from '@/lib/travelmanager/notes';
import { requireAuth } from '@/lib/travelmanager/auth';
import { requireTripAccess, TripAccessError } from '@/lib/travelmanager/trip-access';
import { rateLimit } from '@/lib/rate-limit';
import prisma from '@/lib/prisma';
import { sanitizeObject, validateUUID, validateDateString } from '@/lib/sanitize';

/**
 * The journal editor writes here, not to /api/trips/[id]/notes, so the note has
 * to be read purely to find the trip that authorizes it.
 *
 * A collaborator may edit any note on a shared trip, not only their own: the
 * journal is one shared document per trip and the trip is the authority. The
 * row's userId records who wrote it, nothing more.
 */
async function tripIdForNote(id: string): Promise<string | null> {
  const note = await prisma.tripNote.findUnique({ where: { id }, select: { tripId: true } });
  return note?.tripId ?? null;
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const rateLimited = rateLimit(request, 'write');
    if (rateLimited) return rateLimited;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id } = await params;
    if (!validateUUID(id)) {
      return NextResponse.json({ error: 'Invalid note ID' }, { status: 400 });
    }

    const tripId = await tripIdForNote(id);
    if (!tripId) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }
    await requireTripAccess(tripId, user.id, 'edit');

    const body = await request.json();
    const sanitized = sanitizeObject(body, ['date', 'content']);

    if (sanitized.date && !validateDateString(sanitized.date as string)) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
    }

    const note = await updateTripNote(id, sanitized as Parameters<typeof updateTripNote>[1], user.id);
    return NextResponse.json(note);
  } catch (error) {
    if (error instanceof TripAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error updating note:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to update note' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const rateLimited = rateLimit(request, 'write');
    if (rateLimited) return rateLimited;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id } = await params;
    if (!validateUUID(id)) {
      return NextResponse.json({ error: 'Invalid note ID' }, { status: 400 });
    }

    const tripId = await tripIdForNote(id);
    if (!tripId) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }
    await requireTripAccess(tripId, user.id, 'edit');

    await deleteTripNote(id, user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof TripAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error deleting note:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 });
  }
}
