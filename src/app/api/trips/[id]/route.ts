import { NextRequest, NextResponse } from 'next/server';
import { getTripById, updateTrip, deleteTrip } from '@/lib/travelmanager/trips';
import { requireAuth } from '@/lib/travelmanager/auth';
import { rateLimit } from '@/lib/rate-limit';
import { sanitizeObject, validateUUID, validateDateString, validateEnum, TRIP_STATUS_VALUES } from '@/lib/sanitize';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const rateLimitResult = rateLimit(request, 'read');
    if (rateLimitResult) return rateLimitResult;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id } = await params;
    if (!validateUUID(id)) {
      return NextResponse.json({ error: 'Invalid trip ID' }, { status: 400 });
    }
    const trip = await getTripById(id, user.id);
    if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    return NextResponse.json(trip);
  } catch (error) {
    console.error('Error fetching trip:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to fetch trip' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const rateLimitResult = rateLimit(request, 'write');
    if (rateLimitResult) return rateLimitResult;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id } = await params;
    if (!validateUUID(id)) {
      return NextResponse.json({ error: 'Invalid trip ID' }, { status: 400 });
    }

    const body = await request.json();
    const sanitized = sanitizeObject(body, ['title', 'destination', 'startDate', 'endDate', 'status', 'notes', 'budget']);

    if (sanitized.status && !validateEnum(sanitized.status as string, TRIP_STATUS_VALUES)) {
      return NextResponse.json({ error: 'Invalid trip status' }, { status: 400 });
    }

    if (sanitized.startDate && !validateDateString(sanitized.startDate as string)) {
      return NextResponse.json({ error: 'Invalid start date format' }, { status: 400 });
    }

    if (sanitized.endDate && !validateDateString(sanitized.endDate as string)) {
      return NextResponse.json({ error: 'Invalid end date format' }, { status: 400 });
    }

    if (sanitized.budget !== undefined && sanitized.budget !== null && (typeof sanitized.budget !== 'number' || (sanitized.budget as number) < 0)) {
      return NextResponse.json({ error: 'Budget must be a non-negative number' }, { status: 400 });
    }

    const trip = await updateTrip(id, sanitized as Parameters<typeof updateTrip>[1], user.id);
    return NextResponse.json(trip);
  } catch (error) {
    console.error('Error updating trip:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to update trip' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const rateLimitResult = rateLimit(request, 'write');
    if (rateLimitResult) return rateLimitResult;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id } = await params;
    if (!validateUUID(id)) {
      return NextResponse.json({ error: 'Invalid trip ID' }, { status: 400 });
    }
    await deleteTrip(id, user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting trip:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to delete trip' }, { status: 500 });
  }
}
