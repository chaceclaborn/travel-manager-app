import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/travelmanager/auth';
import { rateLimit } from '@/lib/rate-limit';
import { sanitizeString } from '@/lib/sanitize';
import prisma from '@/lib/prisma';

const MAX_EVENTS_PER_REQUEST = 20;

export async function POST(request: NextRequest) {
  try {
    const rateLimited = rateLimit(request, 'write');
    if (rateLimited) return rateLimited;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const body = await request.json();
    const events: { type: string; label: string; page: string; platform?: string }[] = body?.events;

    if (!Array.isArray(events) || events.length === 0) {
      return NextResponse.json({ error: 'events array is required' }, { status: 400 });
    }

    const capped = events.slice(0, MAX_EVENTS_PER_REQUEST);

    await prisma.clickEvent.createMany({
      data: capped.map((e) => ({
        userId: user.id,
        type: sanitizeString(String(e.type || '')).slice(0, 50),
        label: sanitizeString(String(e.label || '')).slice(0, 100),
        page: sanitizeString(String(e.page || '')).slice(0, 200),
        // Closed set rather than free text: this column exists to be grouped on,
        // and a typo'd or spoofed value would silently split the counts it is
        // meant to produce. Anything unrecognised falls back to the column
        // default instead of being stored.
        platform: e.platform === 'ios' ? 'ios' : 'web',
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

    const [featureClicksRaw, frustrationCountRaw, frustrationPagesRaw, sessionsByPlatformRaw] =
      await Promise.all([
        prisma.clickEvent.groupBy({
          by: ['label'],
          where: { ...where, type: 'feature' },
          _count: { label: true },
          orderBy: { _count: { label: 'desc' } },
          take: 20,
        }),
        // Scoped to the 'rage' label, NOT all frustration rows. The retired
        // heuristic wrote `frustration:whitespace` on essentially every click
        // that missed a control (2,371 of 3,115 rows ever recorded); counting
        // those here would relabel years of instrumentation noise as rage
        // clicks and keep the metric useless for another 30 days.
        prisma.clickEvent.count({
          where: { ...where, type: 'frustration', label: { startsWith: 'rage' } },
        }),
        prisma.clickEvent.groupBy({
          by: ['page'],
          where: { ...where, type: 'frustration', label: { startsWith: 'rage' } },
          _count: { page: true },
          orderBy: { _count: { page: 'desc' } },
          take: 10,
        }),
        // The native-vs-web split. Counted from 'session' rows, not clicks, so a
        // single heavy session can't outweigh many light ones.
        prisma.clickEvent.groupBy({
          by: ['platform'],
          where: { ...where, type: 'session' },
          _count: { platform: true },
        }),
      ]);

    const sessions = { ios: 0, web: 0 };
    for (const row of sessionsByPlatformRaw) {
      if (row.platform === 'ios') sessions.ios = row._count.platform;
      else sessions.web = row._count.platform;
    }

    return NextResponse.json({
      featureClicks: featureClicksRaw.map((g) => ({ label: g.label, count: g._count.label })),
      frustrationCount: frustrationCountRaw,
      frustrationPages: frustrationPagesRaw.map((g) => ({ page: g.page, count: g._count.page })),
      sessions,
    });
  } catch (error) {
    console.error('Error fetching click events:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
  }
}
