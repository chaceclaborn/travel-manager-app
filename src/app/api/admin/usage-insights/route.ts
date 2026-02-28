import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/travelmanager/admin';
import { rateLimit } from '@/lib/rate-limit';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const rateLimited = rateLimit(request, 'sensitive');
    if (rateLimited) return rateLimited;

    const { user, response } = await requireAdmin();
    if (!user) return response;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const where = { createdAt: { gte: thirtyDaysAgo } };

    const [
      topFeatures,
      frustrationByPage,
      totalFeatureClicks,
      totalFrustrationClicks,
      dailyEngagement,
      activeUserCount,
    ] = await Promise.all([
      // Top features across all users
      prisma.clickEvent.groupBy({
        by: ['label'],
        where: { ...where, type: 'feature' },
        _count: { label: true },
        orderBy: { _count: { label: 'desc' } },
        take: 10,
      }),
      // Frustration hotspots by page
      prisma.clickEvent.groupBy({
        by: ['page'],
        where: { ...where, type: 'frustration' },
        _count: { page: true },
        orderBy: { _count: { page: 'desc' } },
        take: 10,
      }),
      // Total feature clicks
      prisma.clickEvent.count({
        where: { ...where, type: 'feature' },
      }),
      // Total frustration clicks
      prisma.clickEvent.count({
        where: { ...where, type: 'frustration' },
      }),
      // Daily feature engagement (last 30 days)
      prisma.clickEvent.findMany({
        where: { ...where, type: 'feature' },
        select: { createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      // Unique active users (users who triggered any click event)
      prisma.clickEvent.groupBy({
        by: ['userId'],
        where,
      }),
    ]);

    // Aggregate daily engagement
    const dailyMap = new Map<string, number>();
    for (const event of dailyEngagement) {
      const day = event.createdAt.toISOString().slice(0, 10);
      dailyMap.set(day, (dailyMap.get(day) || 0) + 1);
    }
    const dailyActivity = Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));

    return NextResponse.json({
      topFeatures: topFeatures.map((g: { label: string; _count: { label: number } }) => ({
        label: g.label,
        count: g._count.label,
      })),
      frustrationHotspots: frustrationByPage.map((g: { page: string; _count: { page: number } }) => ({
        page: g.page,
        count: g._count.page,
      })),
      summary: {
        totalFeatureClicks,
        totalFrustrationClicks,
        activeUsers: activeUserCount.length,
      },
      dailyActivity,
    });
  } catch (error) {
    console.error(
      'Admin usage insights error:',
      error instanceof Error ? error.message : error
    );
    return NextResponse.json(
      { error: 'Failed to fetch usage insights' },
      { status: 500 }
    );
  }
}
