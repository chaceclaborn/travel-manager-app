import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/travelmanager/admin';
import { rateLimit } from '@/lib/rate-limit';
import prisma from '@/lib/prisma';
import type { FeedbackStatus } from '@/lib/generated/prisma';

export async function GET(request: NextRequest) {
  try {
    const rateLimited = rateLimit(request, 'sensitive');
    if (rateLimited) return rateLimited;

    const { user, response } = await requireAdmin();
    if (!user) return response;

    const status = request.nextUrl.searchParams.get('status') as FeedbackStatus | null;
    const limit = Math.min(Number(request.nextUrl.searchParams.get('limit')) || 50, 100);

    const feedback = await prisma.feedback.findMany({
      where: status ? { status } : undefined,
      include: { user: { select: { email: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return NextResponse.json({ feedback });
  } catch (error) {
    console.error('Admin feedback error:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to fetch feedback' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const rateLimited = rateLimit(request, 'sensitive');
    if (rateLimited) return rateLimited;

    const { user, response } = await requireAdmin();
    if (!user) return response;

    const { id, status, category } = await request.json();
    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Feedback id required' }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    if (status) data.status = status;
    if (category) data.category = category;
    if (status === 'RESOLVED') data.resolvedAt = new Date();

    const updated = await prisma.feedback.update({
      where: { id },
      data,
    });

    return NextResponse.json({ feedback: updated });
  } catch (error) {
    console.error('Admin feedback update error:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to update feedback' }, { status: 500 });
  }
}
