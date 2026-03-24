import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/travelmanager/auth';
import { rateLimit } from '@/lib/rate-limit';
import { revokeGmailAccess } from '@/lib/travelmanager/gmail';

export async function POST(request: NextRequest) {
  try {
    const rateLimitResult = rateLimit(request, 'sensitive');
    if (rateLimitResult) return rateLimitResult;

    const { user, response } = await requireAuth();
    if (!user) return response;

    await revokeGmailAccess(user.id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to disconnect Gmail' }, { status: 500 });
  }
}
