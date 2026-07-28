import { NextRequest, NextResponse } from 'next/server';
import {
  listCollaborators,
  listInviteCandidates,
  inviteCollaborator,
} from '@/lib/travelmanager/collaborators';
import { TripAccessError, TRIP_ROLE_VALUES, type TripRoleValue } from '@/lib/travelmanager/trip-access';
import { requireAuth } from '@/lib/travelmanager/auth';
import { rateLimit } from '@/lib/rate-limit';
import { validateEnum } from '@/lib/sanitize';

/** Anyone with view access sees the member list; only the owner gets candidates. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const rateLimited = rateLimit(request, 'read');
    if (rateLimited) return rateLimited;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id } = await params;
    const result = await listCollaborators(id, user.id);

    // Candidates would enumerate the owner's friend list, so they are owner-only.
    const candidates = result.isOwner ? await listInviteCandidates(id, user.id) : [];
    return NextResponse.json({ ...result, candidates });
  } catch (error) {
    if (error instanceof TripAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error listing collaborators:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to load collaborators' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // 'sensitive' rather than 'write': this sends someone else a push.
    const rateLimited = rateLimit(request, 'sensitive');
    if (rateLimited) return rateLimited;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id } = await params;
    const body = await request.json();

    const userId = typeof body.userId === 'string' ? body.userId : '';
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }
    const role: string = typeof body.role === 'string' ? body.role : 'VIEWER';
    if (!validateEnum(role, TRIP_ROLE_VALUES)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    await inviteCollaborator(id, user.id, userId, role as TripRoleValue);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof TripAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error inviting collaborator:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to invite' }, { status: 500 });
  }
}
