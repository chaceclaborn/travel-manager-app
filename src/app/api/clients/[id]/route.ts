import { NextRequest, NextResponse } from 'next/server';
import { getClientById, updateClient, deleteClient } from '@/lib/travelmanager/clients';
import { requireAuth } from '@/lib/travelmanager/auth';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id } = await params;
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
    const { name, company, email, phone, notes } = await request.json();
    const client = await updateClient(id, { name, company, email, phone, notes }, user.id);
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
    await deleteClient(id, user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting client:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to delete client' }, { status: 500 });
  }
}
