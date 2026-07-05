import { NextRequest, NextResponse } from 'next/server';
import { deleteStop } from '@/lib/travelmanager/stops';
import { requireAuth } from '@/lib/travelmanager/auth';
import { rateLimit } from '@/lib/rate-limit';
import { validateUUID } from '@/lib/sanitize';

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
