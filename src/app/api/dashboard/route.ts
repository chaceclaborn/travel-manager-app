import { NextResponse } from 'next/server';
import { getDashboardStats, getUpcomingTrips, getRecentActivity } from '@/lib/travelmanager/trips';
import { requireAuth } from '@/lib/travelmanager/auth';

export async function GET() {
  try {
    const { user, response } = await requireAuth();
    if (!user) return response;

    const stats = await getDashboardStats(user.id);
    const upcoming = await getUpcomingTrips(user.id, 5);
    const recent = await getRecentActivity(user.id, 5);

    return NextResponse.json({ stats, upcoming, recent });
  } catch (error) {
    console.error('Error fetching dashboard data:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 });
  }
}
