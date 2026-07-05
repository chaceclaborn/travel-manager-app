import { NextRequest, NextResponse } from 'next/server';
import { getFriendById, updateFriend, deleteFriend } from '@/lib/travelmanager/friends';
import { requireAuth } from '@/lib/travelmanager/auth';
import { rateLimit } from '@/lib/rate-limit';
import { sanitizeObject, validateUUID, validateEmail } from '@/lib/sanitize';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const rateLimited = rateLimit(request, 'read');
    if (rateLimited) return rateLimited;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id } = await params;
    if (!validateUUID(id)) {
      return NextResponse.json({ error: 'Invalid friend ID' }, { status: 400 });
    }
    const friend = await getFriendById(id, user.id);
    if (!friend) return NextResponse.json({ error: 'Friend not found' }, { status: 404 });
    return NextResponse.json(friend);
  } catch (error) {
    console.error('Error fetching friend:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to fetch friend' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const rateLimited = rateLimit(request, 'write');
    if (rateLimited) return rateLimited;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id } = await params;
    if (!validateUUID(id)) {
      return NextResponse.json({ error: 'Invalid friend ID' }, { status: 400 });
    }

    const body = await request.json();
    const sanitized = sanitizeObject(body, ['name', 'email', 'phone', 'notes']);

    if (sanitized.email && !validateEmail(sanitized.email as string)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    const friend = await updateFriend(id, sanitized as Parameters<typeof updateFriend>[1], user.id);
    return NextResponse.json(friend);
  } catch (error) {
    console.error('Error updating friend:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to update friend' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const rateLimited = rateLimit(request, 'write');
    if (rateLimited) return rateLimited;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id } = await params;
    if (!validateUUID(id)) {
      return NextResponse.json({ error: 'Invalid friend ID' }, { status: 400 });
    }
    await deleteFriend(id, user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting friend:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to delete friend' }, { status: 500 });
  }
}
