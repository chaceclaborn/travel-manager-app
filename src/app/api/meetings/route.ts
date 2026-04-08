import { NextRequest, NextResponse } from 'next/server';
import { getMyMeetings, createMeeting } from '@/lib/travelmanager/meetings';
import { requireAuth } from '@/lib/travelmanager/auth';
import { rateLimit } from '@/lib/rate-limit';
import { sanitizeObject, validateUUID, validateDateString } from '@/lib/sanitize';
import prisma from '@/lib/prisma';

const MEETING_ALLOWED_FIELDS = ['title', 'startDateTime', 'endDateTime', 'timezone', 'location', 'notes', 'tripId', 'clientId'];

export async function GET(request: NextRequest) {
  try {
    const rateLimited = rateLimit(request, 'read');
    if (rateLimited) return rateLimited;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const meetings = await getMyMeetings(user.id);
    return NextResponse.json(meetings);
  } catch (error) {
    console.error('Error fetching meetings:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to fetch meetings' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const rateLimited = rateLimit(request, 'write');
    if (rateLimited) return rateLimited;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const body = await request.json();
    const sanitized = sanitizeObject(body, MEETING_ALLOWED_FIELDS);

    if (!sanitized.title || !sanitized.startDateTime) {
      return NextResponse.json({ error: 'Title and start date/time are required' }, { status: 400 });
    }

    if (!validateDateString(sanitized.startDateTime as string)) {
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

    const meeting = await createMeeting(sanitized as unknown as Parameters<typeof createMeeting>[0], user.id);
    return NextResponse.json(meeting, { status: 201 });
  } catch (error) {
    console.error('Error creating meeting:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to create meeting' }, { status: 500 });
  }
}
