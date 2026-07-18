import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/travelmanager/auth';
import { rateLimit } from '@/lib/rate-limit';
import { validateUUID } from '@/lib/sanitize';

const MAX_BULK_IDS = 100;

export async function POST(request: NextRequest) {
  try {
    const rateLimited = rateLimit(request, 'write');
    if (rateLimited) return rateLimited;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const body = await request.json();
    const ids = body?.ids;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'ids must be a non-empty array' }, { status: 400 });
    }
    if (ids.length > MAX_BULK_IDS) {
      return NextResponse.json({ error: `Cannot delete more than ${MAX_BULK_IDS} trips at once` }, { status: 400 });
    }
    if (!ids.every((id) => typeof id === 'string' && validateUUID(id))) {
      return NextResponse.json({ error: 'All ids must be valid UUIDs' }, { status: 400 });
    }

    // Transaction: verify ownership of every ID, then delete only those that belong to the user.
    // Using deleteMany with { userId } as a where clause ensures rows owned by other users are untouched.
    const deleted = await prisma.$transaction(async (tx) => {
      const owned = await tx.trip.findMany({
        where: { id: { in: ids }, userId: user.id },
        select: { id: true },
      });
      const ownedIds = owned.map((t) => t.id);
      if (ownedIds.length === 0) return 0;

      const result = await tx.trip.deleteMany({
        where: { id: { in: ownedIds }, userId: user.id },
      });
      return result.count;
    });

    return NextResponse.json({ success: true, deleted });
  } catch (error) {
    console.error('Error bulk-deleting trips:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to delete trips' }, { status: 500 });
  }
}
