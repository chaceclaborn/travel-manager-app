import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/travelmanager/auth';
import { rateLimit } from '@/lib/rate-limit';
import prisma from '@/lib/prisma';

const MAX_EVENTS_PER_REQUEST = 20;

export async function POST(request: NextRequest) {
  try {
    const rateLimited = rateLimit(request, 'write');
    if (rateLimited) return rateLimited;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const body = await request.json();
    const events: { type: string; label: string; page: string }[] = body?.events;

    if (!Array.isArray(events) || events.length === 0) {
      return NextResponse.json({ error: 'events array is required' }, { status: 400 });
    }

    const capped = events.slice(0, MAX_EVENTS_PER_REQUEST);

    await prisma.clickEvent.createMany({
      data: capped.map((e) => ({
        userId: user.id,
        type: String(e.type || '').slice(0, 50),
        label: String(e.label || '').slice(0, 100),
        page: String(e.page || '').slice(0, 200),
      })),
    });

    return NextResponse.json({ ok: true, count: capped.length });
  } catch (error) {
    console.error('Error saving click events:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to save events' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const rateLimited = rateLimit(request, 'read');
    if (rateLimited) return rateLimited;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const where = {
      userId: user.id,
      createdAt: { gte: thirtyDaysAgo },
    };

    const [featureClicksRaw, frustrationCountRaw, frustrationPagesRaw] = await Promise.all([
      prisma.clickEvent.groupBy({
        by: ['label'],
        where: { ...where, type: 'feature' },
        _count: { label: true },
        orderBy: { _count: { label: 'desc' } },
        take: 20,
      }),
      prisma.clickEvent.count({
        where: { ...where, type: 'frustration' },
      }),
      prisma.clickEvent.groupBy({
        by: ['page'],
        where: { ...where, type: 'frustration' },
        _count: { page: true },
        orderBy: { _count: { page: 'desc' } },
        take: 10,
      }),
    ]);

    return NextResponse.json({
      featureClicks: featureClicksRaw.map((g) => ({ label: g.label, count: g._count.label })),
      frustrationCount: frustrationCountRaw,
      frustrationPages: frustrationPagesRaw.map((g) => ({ page: g.page, count: g._count.page })),
    });
  } catch (error) {
    console.error('Error fetching click events:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
  }
}
