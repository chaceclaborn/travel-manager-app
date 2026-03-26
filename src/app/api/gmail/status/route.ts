import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/travelmanager/auth';
import { rateLimit } from '@/lib/rate-limit';
import { isGmailConnected } from '@/lib/travelmanager/gmail';

export async function GET(request: NextRequest) {
  try {
    const rateLimitResult = rateLimit(request, 'read');
    if (rateLimitResult) return rateLimitResult;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const connected = await isGmailConnected(user.id);
    return NextResponse.json({ connected });
  } catch {
    return NextResponse.json({ connected: false });
  }
}
