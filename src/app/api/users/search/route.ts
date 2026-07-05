import { NextRequest, NextResponse } from 'next/server';
import { searchUsers } from '@/lib/travelmanager/friendships';
import { requireAuth } from '@/lib/travelmanager/auth';
import { rateLimit } from '@/lib/rate-limit';
import { sanitizeString } from '@/lib/sanitize';

export async function GET(request: NextRequest) {
  try {
    const rateLimitResult = rateLimit(request, 'read');
    if (rateLimitResult) return rateLimitResult;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const raw = request.nextUrl.searchParams.get('q') ?? '';
    const q = sanitizeString(raw);

    const users = await searchUsers(user.id, q);
    return NextResponse.json(users);
  } catch (error) {
    console.error('Error searching users:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to search users' }, { status: 500 });
  }
}
