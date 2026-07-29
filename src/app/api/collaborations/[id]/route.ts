import { NextRequest, NextResponse } from 'next/server';
import { acceptInvitation, declineOrLeave } from '@/lib/travelmanager/collaborators';
import { TripAccessError } from '@/lib/travelmanager/trip-access';
import { requireAuth } from '@/lib/travelmanager/auth';
import { rateLimit } from '@/lib/rate-limit';

/** Accept an invitation addressed to me. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const rateLimited = rateLimit(request, 'write');
    if (rateLimited) return rateLimited;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id } = await params;
    const body = await request.json();
    if (body.action !== 'accept') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    await acceptInvitation(id, user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof TripAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error accepting invitation:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to accept invitation' }, { status: 500 });
  }
}

/** Decline an invitation, or leave a trip I had joined. Same row, same delete. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const rateLimited = rateLimit(request, 'write');
    if (rateLimited) return rateLimited;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id } = await params;
    await declineOrLeave(id, user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof TripAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error declining invitation:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to decline invitation' }, { status: 500 });
  }
}
