import { NextRequest, NextResponse } from 'next/server';
import { getTripNotes, createTripNote } from '@/lib/travelmanager/notes';
import { requireAuth } from '@/lib/travelmanager/auth';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id } = await params;
    const notes = await getTripNotes(id, user.id);
    return NextResponse.json(notes);
  } catch (error) {
    console.error('Error fetching notes:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id: tripId } = await params;
    const body = await request.json();

    if (!body.content?.trim()) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    if (!body.date) {
      return NextResponse.json({ error: 'Date is required' }, { status: 400 });
    }

    const note = await createTripNote({ ...body, tripId }, user.id);
    return NextResponse.json(note, { status: 201 });
  } catch (error) {
    console.error('Error creating note:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to create note' }, { status: 500 });
  }
}
