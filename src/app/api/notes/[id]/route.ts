import { NextRequest, NextResponse } from 'next/server';
import { updateTripNote, deleteTripNote } from '@/lib/travelmanager/notes';
import { requireAuth } from '@/lib/travelmanager/auth';
import { sanitizeObject, validateUUID, validateDateString } from '@/lib/sanitize';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id } = await params;
    if (!validateUUID(id)) {
      return NextResponse.json({ error: 'Invalid note ID' }, { status: 400 });
    }

    const body = await request.json();
    const sanitized = sanitizeObject(body, ['date', 'content']);

    if (sanitized.date && !validateDateString(sanitized.date as string)) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
    }

    const note = await updateTripNote(id, sanitized as Parameters<typeof updateTripNote>[1], user.id);
    return NextResponse.json(note);
  } catch (error) {
    console.error('Error updating note:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to update note' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id } = await params;
    if (!validateUUID(id)) {
      return NextResponse.json({ error: 'Invalid note ID' }, { status: 400 });
    }
    await deleteTripNote(id, user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting note:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 });
  }
}
