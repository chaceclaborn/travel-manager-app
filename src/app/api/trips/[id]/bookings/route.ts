import { NextRequest, NextResponse } from 'next/server';
import { getBookings, createBooking } from '@/lib/travelmanager/bookings';
import { requireAuth } from '@/lib/travelmanager/auth';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id } = await params;
    const bookings = await getBookings(id, user.id);
    return NextResponse.json(bookings);
  } catch (error) {
    console.error('Error fetching bookings:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to fetch bookings' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id: tripId } = await params;
    const body = await request.json();
    const booking = await createBooking({ ...body, tripId }, user.id);
    return NextResponse.json(booking, { status: 201 });
  } catch (error) {
    console.error('Error creating booking:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to create booking' }, { status: 500 });
  }
}
