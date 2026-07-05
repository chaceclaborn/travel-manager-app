import { NextRequest, NextResponse } from 'next/server';
import { getFriends, createFriend } from '@/lib/travelmanager/friends';
import { requireAuth } from '@/lib/travelmanager/auth';
import { rateLimit } from '@/lib/rate-limit';
import { sanitizeObject, validateEmail } from '@/lib/sanitize';

export async function GET(request: NextRequest) {
  try {
    const rateLimitResult = rateLimit(request, 'read');
    if (rateLimitResult) return rateLimitResult;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const friends = await getFriends(user.id);
    return NextResponse.json(friends);
  } catch (error) {
    console.error('Error fetching friends:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to fetch friends' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const rateLimitResult = rateLimit(request, 'write');
    if (rateLimitResult) return rateLimitResult;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const body = await request.json();
    const sanitized = sanitizeObject(body, ['name', 'email', 'phone', 'notes']);
    const { name, email, phone, notes } = sanitized;

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    if (email && !validateEmail(email as string)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    const friend = await createFriend({ name, email, phone, notes } as Parameters<typeof createFriend>[0], user.id);
    return NextResponse.json(friend, { status: 201 });
  } catch (error) {
    console.error('Error creating friend:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to create friend' }, { status: 500 });
  }
}
