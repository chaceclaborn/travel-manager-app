import { NextRequest, NextResponse } from 'next/server';
import { getMyBookings, createBooking } from '@/lib/travelmanager/bookings';
import { requireAuth } from '@/lib/travelmanager/auth';

export async function GET() {
  try {
    const { user, response } = await requireAuth();
    if (!user) return response;

    const bookings = await getMyBookings(user.id);
    return NextResponse.json(bookings);
  } catch (error) {
    console.error('Error fetching bookings:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to fetch bookings' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, response } = await requireAuth();
    if (!user) return response;

    const body = await request.json();

    if (!body.provider || !body.type) {
      return NextResponse.json({ error: 'Provider and type are required' }, { status: 400 });
    }

    const booking = await createBooking(body, user.id);
    return NextResponse.json(booking, { status: 201 });
  } catch (error) {
    console.error('Error creating booking:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to create booking' }, { status: 500 });
  }
}
