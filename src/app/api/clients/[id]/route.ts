import { NextRequest, NextResponse } from 'next/server';
import { getClientById, updateClient, deleteClient } from '@/lib/travelmanager/clients';
import { requireAuth } from '@/lib/travelmanager/auth';
import { sanitizeObject, validateUUID, validateEmail } from '@/lib/sanitize';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id } = await params;
    if (!validateUUID(id)) {
      return NextResponse.json({ error: 'Invalid client ID' }, { status: 400 });
    }
    const client = await getClientById(id, user.id);
    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    return NextResponse.json(client);
  } catch (error) {
    console.error('Error fetching client:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to fetch client' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id } = await params;
    if (!validateUUID(id)) {
      return NextResponse.json({ error: 'Invalid client ID' }, { status: 400 });
    }

    const body = await request.json();
    const sanitized = sanitizeObject(body, ['name', 'company', 'email', 'phone', 'notes']);

    if (sanitized.email && !validateEmail(sanitized.email as string)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    const client = await updateClient(id, sanitized as Parameters<typeof updateClient>[1], user.id);
    return NextResponse.json(client);
  } catch (error) {
    console.error('Error updating client:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to update client' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id } = await params;
    if (!validateUUID(id)) {
      return NextResponse.json({ error: 'Invalid client ID' }, { status: 400 });
    }
    await deleteClient(id, user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting client:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to delete client' }, { status: 500 });
  }
}
