import { NextRequest, NextResponse } from 'next/server';
import { getTripClients, linkClientToTrip, unlinkClientFromTrip } from '@/lib/travelmanager/trips';
import { requireAuth } from '@/lib/travelmanager/auth';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id } = await params;
    const clients = await getTripClients(id, user.id);
    return NextResponse.json(clients);
  } catch (error) {
    console.error('Error fetching trip clients:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to fetch trip clients' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id } = await params;
    const body = await request.json();
    const { clientId, notes, action } = body;

    if (!clientId) {
      return NextResponse.json({ error: 'Client ID is required' }, { status: 400 });
    }

    if (action === 'unlink') {
      await unlinkClientFromTrip(id, clientId, user.id);
      return NextResponse.json({ success: true });
    }

    const link = await linkClientToTrip(id, clientId, user.id, notes);
    return NextResponse.json(link, { status: 201 });
  } catch (error) {
    console.error('Error linking client to trip:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to link client to trip' }, { status: 500 });
  }
}
