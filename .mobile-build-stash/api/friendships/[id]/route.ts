import { NextRequest, NextResponse } from 'next/server';
import { respondToRequest, removeFriendship, FriendshipError } from '@/lib/travelmanager/friendships';
import { requireAuth } from '@/lib/travelmanager/auth';
import { rateLimit } from '@/lib/rate-limit';
import { validateUUID } from '@/lib/sanitize';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const rateLimited = rateLimit(request, 'write');
    if (rateLimited) return rateLimited;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id } = await params;
    if (!validateUUID(id)) {
      return NextResponse.json({ error: 'Invalid friendship ID' }, { status: 400 });
    }

    const body = await request.json();
    if (body.action !== 'accept') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    await respondToRequest(user.id, id, true);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof FriendshipError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error updating friendship:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to update friendship' }, { status: 500 });
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
      return NextResponse.json({ error: 'Invalid friendship ID' }, { status: 400 });
    }

    await removeFriendship(user.id, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof FriendshipError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error deleting friendship:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to delete friendship' }, { status: 500 });
  }
}
