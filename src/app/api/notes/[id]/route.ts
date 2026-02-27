import { NextRequest, NextResponse } from 'next/server';
import { updateTripNote, deleteTripNote } from '@/lib/travelmanager/notes';
import { requireAuth } from '@/lib/travelmanager/auth';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id } = await params;
    const body = await request.json();
    const note = await updateTripNote(id, body, user.id);
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
    await deleteTripNote(id, user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting note:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 });
  }
}
