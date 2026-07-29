import { NextRequest, NextResponse } from 'next/server';
import { listMyInvitations, listMyCollaborations } from '@/lib/travelmanager/collaborators';
import { requireAuth } from '@/lib/travelmanager/auth';
import { rateLimit } from '@/lib/rate-limit';

/**
 * The invitee side of collaboration, deliberately user-scoped rather than
 * trip-scoped.
 *
 * A pending invitation grants no trip access at all, so this cannot live under
 * /api/trips/[id]/* — the caller would fail authorization on the very trip they
 * are being asked to join. Its own namespace means it never has to fake access.
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimited = rateLimit(request, 'read');
    if (rateLimited) return rateLimited;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const [invitations, collaborations] = await Promise.all([
      listMyInvitations(user.id),
      listMyCollaborations(user.id),
    ]);
    return NextResponse.json({ invitations, collaborations });
  } catch (error) {
    console.error('Error listing collaborations:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to load invitations' }, { status: 500 });
  }
}
