import { NextRequest, NextResponse } from 'next/server';
import { getAuditLogs } from '@/lib/travelmanager/trips';
import { requireAuth } from '@/lib/travelmanager/auth';
import { rateLimit } from '@/lib/rate-limit';

export async function GET(request: NextRequest) {
  try {
    const rateLimited = rateLimit(request, 'read');
    if (rateLimited) return rateLimited;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const logs = await getAuditLogs(user.id, 50);
    const signIns = logs.filter((log) => log.action === 'sign_in');

    return NextResponse.json({ sessions: signIns });
  } catch (error) {
    console.error('Error fetching sessions:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
  }
}
