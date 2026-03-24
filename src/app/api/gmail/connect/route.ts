import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/travelmanager/auth';
import { rateLimit } from '@/lib/rate-limit';
import { getGmailAuthUrl } from '@/lib/travelmanager/gmail';

export async function GET(request: NextRequest) {
  try {
    const rateLimitResult = rateLimit(request, 'write');
    if (rateLimitResult) return rateLimitResult;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const url = getGmailAuthUrl(user.id);
    return NextResponse.json({ url });
  } catch {
    return NextResponse.json({ error: 'Failed to generate auth URL' }, { status: 500 });
  }
}
