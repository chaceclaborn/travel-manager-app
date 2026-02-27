import { NextRequest, NextResponse } from 'next/server';
import { getClients, createClient } from '@/lib/travelmanager/clients';
import { requireAuth } from '@/lib/travelmanager/auth';

export async function GET() {
  try {
    const { user, response } = await requireAuth();
    if (!user) return response;

    const clients = await getClients(user.id);
    return NextResponse.json(clients);
  } catch (error) {
    console.error('Error fetching clients:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, response } = await requireAuth();
    if (!user) return response;

    const body = await request.json();
    const { name, company, email, phone, notes } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const client = await createClient({ name, company, email, phone, notes }, user.id);
    return NextResponse.json(client, { status: 201 });
  } catch (error) {
    console.error('Error creating client:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to create client' }, { status: 500 });
  }
}
