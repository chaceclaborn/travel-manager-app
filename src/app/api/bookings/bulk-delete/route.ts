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

    // Verify ownership inside a transaction, then delete atomically
    const deletedCount = await prisma.$transaction(async (tx) => {
      const owned = await tx.booking.findMany({
        where: { id: { in: ids }, userId: user.id },
        select: { id: true },
      });
      const ownedIds = owned.map((b) => b.id);
      if (ownedIds.length === 0) return 0;
      const result = await tx.booking.deleteMany({ where: { id: { in: ownedIds }, userId: user.id } });
      return result.count;
    });

    return NextResponse.json({ success: true, deleted: deletedCount });
  } catch (error) {
    console.error('Error bulk deleting bookings:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to bulk delete bookings' }, { status: 500 });
  }
}
