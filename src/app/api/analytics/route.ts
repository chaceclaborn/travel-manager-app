import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/travelmanager/auth';
import { rateLimit } from '@/lib/rate-limit';
import prisma from '@/lib/prisma';

function getPeriodDate(period: string): Date | null {
  const now = new Date();
  switch (period) {
    case '3months':
      return new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
    case '6months':
      return new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
    case '1year':
      return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    case 'all':
    default:
      return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const rateLimited = rateLimit(request, 'read');
    if (rateLimited) return rateLimited;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const period = request.nextUrl.searchParams.get('period') || 'all';
    const sinceDate = getPeriodDate(period);

    const tripWhere = {
      userId: user.id,
      ...(sinceDate ? { createdAt: { gte: sinceDate } } : {}),
    };

    const expenseWhere = {
      userId: user.id,
      ...(sinceDate ? { date: { gte: sinceDate } } : {}),
    };

    // Parallel queries for performance
    const [
      spendingGrouped,
      trips,
      totalExpenses,
      commissionBookings,
    ] = await Promise.all([
      prisma.expense.groupBy({
        by: ['category'],
        where: expenseWhere,
        _sum: { amount: true },
      }),
      prisma.trip.findMany({
        where: tripWhere,
        select: {
          id: true,
          destination: true,
          startDate: true,
          endDate: true,
          createdAt: true,
        },
      }),
      prisma.expense.aggregate({
        where: expenseWhere,
        _sum: { amount: true },
      }),
      // Commission rollup. startDateTime is a text column, so the period
      // filter happens in JS below (per-user booking counts are small).
      prisma.booking.findMany({
        where: {
          userId: user.id,
          status: 'ACTIVE',
          commissionAmount: { not: null },
        },
        select: {
          commissionAmount: true,
          commissionPaid: true,
          startDateTime: true,
          createdAt: true,
        },
      }),
    ]);

    // Spending by category
    const spendingByCategory = spendingGrouped
      .map((g) => ({
        category: g.category,
        total: g._sum.amount || 0,
      }))
      .sort((a, b) => b.total - a.total);

    // Trips by month
    const tripsByMonthMap = new Map<string, number>();
    for (const trip of trips) {
      const date = trip.startDate || trip.createdAt;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      tripsByMonthMap.set(key, (tripsByMonthMap.get(key) || 0) + 1);
    }
    const tripsByMonth = Array.from(tripsByMonthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, count]) => ({ month, count }));

    // Top destinations
    const destMap = new Map<string, number>();
    for (const trip of trips) {
      if (trip.destination) {
        const dest = trip.destination.trim();
        destMap.set(dest, (destMap.get(dest) || 0) + 1);
      }
    }
    const topDestinations = Array.from(destMap.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([destination, count]) => ({ destination, count }));

    // Travel days by quarter
    const quarterMap = new Map<string, number>();
    for (const trip of trips) {
      if (trip.startDate && trip.endDate) {
        const days = Math.ceil(
          (trip.endDate.getTime() - trip.startDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        const q = Math.ceil((trip.startDate.getMonth() + 1) / 3);
        const key = `${trip.startDate.getFullYear()} Q${q}`;
        quarterMap.set(key, (quarterMap.get(key) || 0) + days);
      }
    }
    const travelDaysByQuarter = Array.from(quarterMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([quarter, days]) => ({ quarter, days }));

    // Commissions: bucket by travel month (startDateTime, falling back to
    // createdAt when the booking has no date), split paid vs pending.
    const commissionMonthMap = new Map<string, { paid: number; pending: number }>();
    let commissionTotal = 0;
    let commissionPending = 0;
    for (const b of commissionBookings) {
      const amount = b.commissionAmount ?? 0;
      if (amount <= 0) continue;
      const parsed = b.startDateTime ? new Date(b.startDateTime) : b.createdAt;
      const date = isNaN(parsed.getTime()) ? b.createdAt : parsed;
      if (sinceDate && date < sinceDate) continue;
      commissionTotal += amount;
      if (!b.commissionPaid) commissionPending += amount;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const bucket = commissionMonthMap.get(key) ?? { paid: 0, pending: 0 };
      if (b.commissionPaid) bucket.paid += amount;
      else bucket.pending += amount;
      commissionMonthMap.set(key, bucket);
    }
    const commissionsByMonth = Array.from(commissionMonthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, sums]) => ({ month, ...sums }));

    // Summary stats
    const totalSpent = totalExpenses._sum.amount || 0;
    const totalTrips = trips.length;
    const averageTripCost = totalTrips > 0 ? totalSpent / totalTrips : 0;

    // Most visited destination
    const mostVisited = topDestinations[0]?.destination || null;

    return NextResponse.json({
      spendingByCategory,
      tripsByMonth,
      topDestinations,
      travelDaysByQuarter,
      totalSpent,
      totalTrips,
      averageTripCost,
      mostVisited,
      commissionsByMonth,
      commissionTotal,
      commissionPending,
    });
  } catch (error) {
    console.error('Error fetching analytics:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to fetch analytics data' }, { status: 500 });
  }
}
