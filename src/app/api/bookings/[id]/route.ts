import { NextRequest, NextResponse } from 'next/server';
import { getBookingById, updateBooking, deleteBooking } from '@/lib/travelmanager/bookings';
import { requireAuth } from '@/lib/travelmanager/auth';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id } = await params;
    const booking = await getBookingById(id, user.id);
    return NextResponse.json(booking);
  } catch (error) {
    console.error('Error fetching booking:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to fetch booking' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id } = await params;
    const body = await request.json();
    const booking = await updateBooking(id, body, user.id);
    return NextResponse.json(booking);
  } catch (error) {
    console.error('Error updating booking:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to update booking' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id } = await params;
    await deleteBooking(id, user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting booking:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to delete booking' }, { status: 500 });
  }
}
