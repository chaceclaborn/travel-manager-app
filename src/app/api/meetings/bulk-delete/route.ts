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

    // deleteMany silently skips rows not owned by this user, so we can batch safely
    const results = await prisma.$transaction(
      ids.map((id: string) => prisma.meeting.deleteMany({ where: { id, userId: user.id } }))
    );
    const deleted = results.reduce((sum, r) => sum + r.count, 0);

    return NextResponse.json({ success: true, deleted });
  } catch (error) {
    console.error('Error bulk deleting meetings:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to bulk delete meetings' }, { status: 500 });
  }
}
