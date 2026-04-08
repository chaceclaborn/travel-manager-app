import { NextRequest, NextResponse } from 'next/server';
import { getMeetingById, updateMeeting, deleteMeeting } from '@/lib/travelmanager/meetings';
import { requireAuth } from '@/lib/travelmanager/auth';
import { rateLimit } from '@/lib/rate-limit';
import { sanitizeObject, validateUUID, validateDateString } from '@/lib/sanitize';

const MEETING_ALLOWED_FIELDS = ['title', 'startDateTime', 'endDateTime', 'timezone', 'location', 'notes', 'tripId', 'clientId'];

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const rateLimited = rateLimit(request, 'read');
    if (rateLimited) return rateLimited;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id } = await params;
    if (!validateUUID(id)) {
      return NextResponse.json({ error: 'Invalid meeting ID' }, { status: 400 });
    }
    const meeting = await getMeetingById(id, user.id);
    return NextResponse.json(meeting);
  } catch (error) {
    console.error('Error fetching meeting:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to fetch meeting' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const rateLimited = rateLimit(request, 'write');
    if (rateLimited) return rateLimited;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id } = await params;
    if (!validateUUID(id)) {
      return NextResponse.json({ error: 'Invalid meeting ID' }, { status: 400 });
    }

    const body = await request.json();
    const sanitized = sanitizeObject(body, MEETING_ALLOWED_FIELDS);

    if (sanitized.startDateTime && !validateDateString(sanitized.startDateTime as string)) {
      return NextResponse.json({ error: 'Invalid start date format' }, { status: 400 });
    }

    if (sanitized.endDateTime && !validateDateString(sanitized.endDateTime as string)) {
      return NextResponse.json({ error: 'Invalid end date format' }, { status: 400 });
    }

    if (sanitized.tripId && !validateUUID(sanitized.tripId as string)) {
      return NextResponse.json({ error: 'Invalid trip ID' }, { status: 400 });
    }

    if (sanitized.clientId && !validateUUID(sanitized.clientId as string)) {
      return NextResponse.json({ error: 'Invalid client ID' }, { status: 400 });
    }

    const meeting = await updateMeeting(id, sanitized as Parameters<typeof updateMeeting>[1], user.id);
    return NextResponse.json(meeting);
  } catch (error) {
    console.error('Error updating meeting:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to update meeting' }, { status: 500 });
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
      return NextResponse.json({ error: 'Invalid meeting ID' }, { status: 400 });
    }
    await deleteMeeting(id, user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting meeting:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to delete meeting' }, { status: 500 });
  }
}
