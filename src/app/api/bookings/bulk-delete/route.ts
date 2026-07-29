import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/travelmanager/auth';
import { rateLimit } from '@/lib/rate-limit';
import { validateUUID } from '@/lib/sanitize';

export async function POST(request: NextRequest) {
  try {
    const rateLimited = rateLimit(request, 'write');
    if (rateLimited) return rateLimited;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const body = await request.json();
    const rawIds = Array.isArray(body?.ids) ? body.ids : null;
    if (!rawIds || rawIds.length === 0) {
      return NextResponse.json({ error: 'ids array is required' }, { status: 400 });
    }

    // Cap to avoid runaway queries
    if (rawIds.length > 200) {
      return NextResponse.json({ error: 'Too many ids (max 200)' }, { status: 400 });
    }

    const ids = rawIds.filter((id: unknown): id is string => typeof id === 'string' && validateUUID(id));
    if (ids.length === 0) {
      return NextResponse.json({ error: 'No valid ids provided' }, { status: 400 });
    }

    // `userId` on a Booking means AUTHOR, not owner — collaboration changed
    // that. A bare `{ userId: user.id }` filter therefore stopped being an
    // ownership check: a collaborator who booked flights on someone else's trip
    // could still hard-delete those rows after being demoted to VIEWER,
    // removed from the trip, or unfriended entirely, because their user id is
    // still stamped on them.
    //
    // Restrict to rows that are genuinely the caller's to destroy: unattached
    // bookings, or bookings on a trip they own. Anything on someone else's trip
    // must go through DELETE /api/bookings/[id], which requires 'edit' on that
    // trip and re-checks the friendship. Deliberately NOT widened to
    // collaborators — bulk delete is an owner-scale action.
    const deletableByCaller = {
      userId: user.id,
      OR: [{ tripId: null }, { trip: { userId: user.id } }],
    };

    const deletedCount = await prisma.$transaction(async (tx) => {
      const owned = await tx.booking.findMany({
        where: { id: { in: ids }, ...deletableByCaller },
        select: { id: true },
      });
      const ownedIds = owned.map((b) => b.id);
      if (ownedIds.length === 0) return 0;
      const result = await tx.booking.deleteMany({
        where: { id: { in: ownedIds }, ...deletableByCaller },
      });
      return result.count;
    });

    return NextResponse.json({ success: true, deleted: deletedCount });
  } catch (error) {
    console.error('Error bulk deleting bookings:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to bulk delete bookings' }, { status: 500 });
  }
}
