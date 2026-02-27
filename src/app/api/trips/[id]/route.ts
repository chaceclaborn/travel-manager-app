import { NextRequest, NextResponse } from 'next/server';
import { getTripById, updateTrip, deleteTrip } from '@/lib/travelmanager/trips';
import { requireAuth } from '@/lib/travelmanager/auth';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id } = await params;
    const trip = await getTripById(id, user.id);
    if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    return NextResponse.json(trip);
  } catch (error) {
    console.error('Error fetching trip:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to fetch trip' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id } = await params;
    const { title, destination, startDate, endDate, status, notes, budget } = await request.json();
    const trip = await updateTrip(id, { title, destination, startDate, endDate, status, notes, budget }, user.id);
    return NextResponse.json(trip);
  } catch (error) {
    console.error('Error updating trip:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to update trip' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id } = await params;
    await deleteTrip(id, user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting trip:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to delete trip' }, { status: 500 });
  }
}
