import { NextRequest, NextResponse } from 'next/server';
import { getTripClients, linkClientToTrip, unlinkClientFromTrip } from '@/lib/travelmanager/trips';
import { requireAuth } from '@/lib/travelmanager/auth';
import { rateLimit } from '@/lib/rate-limit';
import { sanitizeString, validateUUID } from '@/lib/sanitize';

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
    const clients = await getTripClients(id, user.id);
    return NextResponse.json(clients);
  } catch (error) {
    console.error('Error fetching trip clients:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to fetch trip clients' }, { status: 500 });
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
    const { clientId, notes, action } = body;

    if (!clientId || !validateUUID(clientId)) {
      return NextResponse.json({ error: 'Valid client ID is required' }, { status: 400 });
    }

    const sanitizedNotes = notes ? sanitizeString(notes) : undefined;

    if (action === 'unlink') {
      await unlinkClientFromTrip(id, clientId, user.id);
      return NextResponse.json({ success: true });
    }

    const link = await linkClientToTrip(id, clientId, user.id, sanitizedNotes);
    return NextResponse.json(link, { status: 201 });
  } catch (error) {
    console.error('Error linking client to trip:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to link client to trip' }, { status: 500 });
  }
}
