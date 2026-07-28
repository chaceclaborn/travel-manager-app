import { NextRequest, NextResponse } from 'next/server';
import { updateChecklistItem, deleteChecklistItem } from '@/lib/travelmanager/checklists';
import { requireAuth } from '@/lib/travelmanager/auth';
import { requireTripAccess, TripAccessError } from '@/lib/travelmanager/trip-access';
import { rateLimit } from '@/lib/rate-limit';
import prisma from '@/lib/prisma';
import { sanitizeObject, validateUUID } from '@/lib/sanitize';

/**
 * Checking a box goes to this flat endpoint, never to /api/trips/[id]/checklists,
 * so the item has to be read purely to find the trip that authorizes it.
 */
async function tripIdForItem(id: string): Promise<string | null> {
  const item = await prisma.checklistItem.findUnique({ where: { id }, select: { tripId: true } });
  return item?.tripId ?? null;
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const rateLimited = rateLimit(request, 'write');
    if (rateLimited) return rateLimited;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id } = await params;
    if (!validateUUID(id)) {
      return NextResponse.json({ error: 'Invalid checklist item ID' }, { status: 400 });
    }

    const tripId = await tripIdForItem(id);
    if (!tripId) {
      return NextResponse.json({ error: 'Checklist item not found' }, { status: 404 });
    }
    await requireTripAccess(tripId, user.id, 'edit');

    const body = await request.json();
    const sanitized = sanitizeObject(body, ['label', 'checked', 'sortOrder']);
    const item = await updateChecklistItem(id, sanitized as Parameters<typeof updateChecklistItem>[1], user.id);
    return NextResponse.json(item);
  } catch (error) {
    if (error instanceof TripAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error updating checklist item:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to update checklist item' }, { status: 500 });
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
      return NextResponse.json({ error: 'Invalid checklist item ID' }, { status: 400 });
    }

    const tripId = await tripIdForItem(id);
    if (!tripId) {
      return NextResponse.json({ error: 'Checklist item not found' }, { status: 404 });
    }
    await requireTripAccess(tripId, user.id, 'edit');

    await deleteChecklistItem(id, user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof TripAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error deleting checklist item:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to delete checklist item' }, { status: 500 });
  }
}
