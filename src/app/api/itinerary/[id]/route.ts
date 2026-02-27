import { NextRequest, NextResponse } from 'next/server';
import { updateItineraryItem, deleteItineraryItem } from '@/lib/travelmanager/trips';
import { requireAuth } from '@/lib/travelmanager/auth';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id } = await params;
    const body = await request.json();
    const item = await updateItineraryItem(id, body, user.id);
    return NextResponse.json(item);
  } catch (error) {
    console.error('Error updating itinerary item:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to update itinerary item' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id } = await params;
    await deleteItineraryItem(id, user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting itinerary item:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to delete itinerary item' }, { status: 500 });
  }
}
