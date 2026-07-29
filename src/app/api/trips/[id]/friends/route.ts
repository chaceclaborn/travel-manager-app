import { NextRequest, NextResponse } from 'next/server';
import { getTripFriends, linkFriendToTrip, unlinkFriendFromTrip } from '@/lib/travelmanager/trips';
import { requireAuth } from '@/lib/travelmanager/auth';
import { rateLimit } from '@/lib/rate-limit';
import { sanitizeString, validateUUID } from '@/lib/sanitize';
import { TripAccessError } from '@/lib/travelmanager/trip-access';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const rateLimited = rateLimit(request, 'read');
    if (rateLimited) return rateLimited;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id } = await params;
    if (!validateUUID(id)) {
      return NextResponse.json({ error: 'Invalid trip ID' }, { status: 400 });
    }
    const friends = await getTripFriends(id, user.id);
    return NextResponse.json(friends);
  } catch (error) {
    // These delegate to helpers that authorize via requireTripAccess, so
    // without this a denial escapes as a 500 — an authorization failure
    // dressed up as a server fault.
    if (error instanceof TripAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error fetching trip friends:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to fetch trip friends' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const rateLimited = rateLimit(request, 'write');
    if (rateLimited) return rateLimited;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id } = await params;
    if (!validateUUID(id)) {
      return NextResponse.json({ error: 'Invalid trip ID' }, { status: 400 });
    }

    const body = await request.json();
    const { friendId, notes, action } = body;

    if (!friendId || !validateUUID(friendId)) {
      return NextResponse.json({ error: 'Valid friend ID is required' }, { status: 400 });
    }

    const sanitizedNotes = notes ? sanitizeString(notes) : undefined;

    if (action === 'unlink') {
      await unlinkFriendFromTrip(id, friendId, user.id);
      return NextResponse.json({ success: true });
    }

    const link = await linkFriendToTrip(id, friendId, user.id, sanitizedNotes);
    return NextResponse.json(link, { status: 201 });
  } catch (error) {
    // These delegate to helpers that authorize via requireTripAccess, so
    // without this a denial escapes as a 500 — an authorization failure
    // dressed up as a server fault.
    if (error instanceof TripAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error linking friend to trip:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to link friend to trip' }, { status: 500 });
  }
}
