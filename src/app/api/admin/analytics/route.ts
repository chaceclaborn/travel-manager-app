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

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'admin_access',
        ipAddress:
          request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
          request.headers.get('x-real-ip') ??
          null,
        userAgent: request.headers.get('user-agent') ?? null,
        metadata: { page: 'admin_analytics' },
      },
    });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      totalUsers,
      totalTrips,
      totalBookings,
      totalVendors,
      totalClients,
      signInLogs,
      tripStatusGroups,
      attachmentStats,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.trip.count(),
      prisma.booking.count(),
      prisma.vendor.count(),
      prisma.client.count(),
      prisma.auditLog.findMany({
        where: {
          action: 'sign_in',
          createdAt: { gte: thirtyDaysAgo },
        },
        select: { createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.trip.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      prisma.tripAttachment.aggregate({
        _sum: { fileSize: true },
        _count: { _all: true },
      }),
    ]);

    const signInByDay = new Map<string, number>();
    for (const log of signInLogs) {
      const day = log.createdAt.toISOString().slice(0, 10);
      signInByDay.set(day, (signInByDay.get(day) || 0) + 1);
    }
    const signInActivity = Array.from(signInByDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));

    const tripStatusBreakdown = tripStatusGroups.map((g) => ({
      status: g.status,
      count: g._count._all,
    }));

    const storageSummary = {
      totalFiles: attachmentStats._count._all,
      totalSizeBytes: attachmentStats._sum.fileSize || 0,
      totalSizeMB: Number(
        ((attachmentStats._sum.fileSize || 0) / (1024 * 1024)).toFixed(2)
      ),
    };

    return NextResponse.json({
      overview: {
        totalUsers,
        totalTrips,
        totalBookings,
        totalVendors,
        totalClients,
      },
      signInActivity,
      tripStatusBreakdown,
      storageSummary,
    });
  } catch (error) {
    console.error(
      'Admin analytics error:',
      error instanceof Error ? error.message : error
    );
    return NextResponse.json(
      { error: 'Failed to fetch admin analytics' },
      { status: 500 }
    );
  }
}
