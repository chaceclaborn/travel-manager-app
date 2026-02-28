import { NextRequest, NextResponse } from 'next/server';
import { updateItineraryItem, deleteItineraryItem } from '@/lib/travelmanager/trips';
import { requireAuth } from '@/lib/travelmanager/auth';
import { sanitizeObject, validateUUID, validateDateString } from '@/lib/sanitize';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id } = await params;
    if (!validateUUID(id)) {
      return NextResponse.json({ error: 'Invalid itinerary item ID' }, { status: 400 });
    }

    const body = await request.json();
    const sanitized = sanitizeObject(body, ['title', 'date', 'endDate', 'startTime', 'endTime', 'location', 'notes', 'sortOrder', 'vendorId', 'clientId']);

    if (sanitized.date && !validateDateString(sanitized.date as string)) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
    }

    if (sanitized.endDate && !validateDateString(sanitized.endDate as string)) {
      return NextResponse.json({ error: 'Invalid end date format' }, { status: 400 });
    }

    if (sanitized.vendorId && !validateUUID(sanitized.vendorId as string)) {
      return NextResponse.json({ error: 'Invalid vendor ID' }, { status: 400 });
    }

    if (sanitized.clientId && !validateUUID(sanitized.clientId as string)) {
      return NextResponse.json({ error: 'Invalid client ID' }, { status: 400 });
    }

    const item = await updateItineraryItem(id, sanitized as Parameters<typeof updateItineraryItem>[1], user.id);
    return NextResponse.json(item);
  } catch (error) {
    console.error('Error updating itinerary item:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to update itinerary item' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id } = await params;
    if (!validateUUID(id)) {
      return NextResponse.json({ error: 'Invalid itinerary item ID' }, { status: 400 });
    }
    await deleteItineraryItem(id, user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting itinerary item:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to delete itinerary item' }, { status: 500 });
  }
}
