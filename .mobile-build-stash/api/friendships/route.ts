import { NextRequest, NextResponse } from 'next/server';
import { listConnections, sendFriendRequest, FriendshipError } from '@/lib/travelmanager/friendships';
import { requireAuth } from '@/lib/travelmanager/auth';
import { rateLimit } from '@/lib/rate-limit';
import { sanitizeString } from '@/lib/sanitize';

export async function GET(request: NextRequest) {
  try {
    const rateLimitResult = rateLimit(request, 'read');
    if (rateLimitResult) return rateLimitResult;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const connections = await listConnections(user.id);
    return NextResponse.json(connections);
  } catch (error) {
    console.error('Error fetching friendships:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to fetch friendships' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const rateLimitResult = rateLimit(request, 'write');
    if (rateLimitResult) return rateLimitResult;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const body = await request.json();
    const username = typeof body.username === 'string' ? sanitizeString(body.username) : '';

    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    await sendFriendRequest(user.id, username);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    if (error instanceof FriendshipError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error sending friend request:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to send friend request' }, { status: 500 });
  }
}
