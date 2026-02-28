import { NextRequest, NextResponse } from 'next/server';
import { getTripNotes, createTripNote } from '@/lib/travelmanager/notes';
import { requireAuth } from '@/lib/travelmanager/auth';
import { sanitizeObject, validateUUID, validateDateString } from '@/lib/sanitize';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id } = await params;
    if (!validateUUID(id)) {
      return NextResponse.json({ error: 'Invalid trip ID' }, { status: 400 });
    }
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
    if (!validateUUID(tripId)) {
      return NextResponse.json({ error: 'Invalid trip ID' }, { status: 400 });
    }

    const body = await request.json();
    const sanitized = sanitizeObject(body, ['content', 'date']);

    if (!(sanitized.content as string | undefined)?.toString().trim()) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    if (!sanitized.date) {
      return NextResponse.json({ error: 'Date is required' }, { status: 400 });
    }

    if (!validateDateString(sanitized.date as string)) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
    }

    const note = await createTripNote({ ...sanitized, tripId } as Parameters<typeof createTripNote>[0], user.id);
    return NextResponse.json(note, { status: 201 });
  } catch (error) {
    console.error('Error creating note:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to create note' }, { status: 500 });
  }
}
