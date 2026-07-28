import { NextRequest, NextResponse } from 'next/server';
import { removeCollaborator, setCollaboratorRole } from '@/lib/travelmanager/collaborators';
import { TripAccessError, TRIP_ROLE_VALUES, type TripRoleValue } from '@/lib/travelmanager/trip-access';
import { requireAuth } from '@/lib/travelmanager/auth';
import { rateLimit } from '@/lib/rate-limit';
import { validateEnum } from '@/lib/sanitize';

/** Change a collaborator's role. Owner-only (enforced in the data layer). */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const rateLimited = rateLimit(request, 'write');
    if (rateLimited) return rateLimited;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id, userId } = await params;
    const body = await request.json();
    const role: string = typeof body.role === 'string' ? body.role : '';
    if (!validateEnum(role, TRIP_ROLE_VALUES)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    await setCollaboratorRole(id, user.id, userId, role as TripRoleValue);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof TripAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error updating collaborator:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to update collaborator' }, { status: 500 });
  }
}

/** Remove a collaborator. Owner-only. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const rateLimited = rateLimit(request, 'write');
    if (rateLimited) return rateLimited;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id, userId } = await params;
    await removeCollaborator(id, user.id, userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof TripAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error removing collaborator:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to remove collaborator' }, { status: 500 });
  }
}
