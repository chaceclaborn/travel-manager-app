import { NextRequest, NextResponse } from 'next/server';
import { deleteStop, updateStop, STOP_TRAVEL_MODES } from '@/lib/travelmanager/stops';
import { requireAuth } from '@/lib/travelmanager/auth';
import { rateLimit } from '@/lib/rate-limit';
import { sanitizeObject, validateUUID, validateDateString, validateEnum } from '@/lib/sanitize';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stopId: string }> }
) {
  try {
    const rateLimited = rateLimit(request, 'write');
    if (rateLimited) return rateLimited;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id: tripId, stopId } = await params;
    if (!validateUUID(tripId) || !validateUUID(stopId)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const body = await request.json();
    const sanitized = sanitizeObject(body, ['name', 'date', 'notes', 'travelMode']);

    if (sanitized.name !== undefined) {
      const name = typeof sanitized.name === 'string' ? sanitized.name.trim() : '';
      if (!name || name.length > 200) {
        return NextResponse.json({ error: 'Invalid stop name' }, { status: 400 });
      }
      sanitized.name = name;
    }
    if (sanitized.date && !validateDateString(sanitized.date as string)) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
    }
    if (sanitized.travelMode && !validateEnum(sanitized.travelMode as string, STOP_TRAVEL_MODES)) {
      return NextResponse.json({ error: 'Invalid travel mode' }, { status: 400 });
    }

    const stop = await updateStop(stopId, tripId, user.id, sanitized);
    return NextResponse.json(stop);
  } catch (error) {
    console.error('Error updating stop:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to update stop' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stopId: string }> }
) {
  try {
    const rateLimited = rateLimit(request, 'write');
    if (rateLimited) return rateLimited;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id: tripId, stopId } = await params;
    if (!validateUUID(tripId) || !validateUUID(stopId)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    await deleteStop(stopId, tripId, user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting stop:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to delete stop' }, { status: 500 });
  }
}
