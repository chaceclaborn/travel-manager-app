import { NextRequest, NextResponse } from 'next/server';
import { getTrips, createTrip } from '@/lib/travelmanager/trips';
import { requireAuth } from '@/lib/travelmanager/auth';

export async function GET() {
  try {
    const { user, response } = await requireAuth();
    if (!user) return response;

    const trips = await getTrips(user.id);
    return NextResponse.json(trips);
  } catch (error) {
    console.error('Error fetching trips:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to fetch trips' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, response } = await requireAuth();
    if (!user) return response;

    const body = await request.json();
    const { title, destination, startDate, endDate, status, notes, budget } = body;

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    if (status !== 'DRAFT' && (!destination || !startDate || !endDate)) {
      return NextResponse.json({ error: 'Destination, start date, and end date are required for non-draft trips' }, { status: 400 });
    }

    const trip = await createTrip({ title, destination, startDate, endDate, status, notes, budget }, user.id);
    return NextResponse.json(trip, { status: 201 });
  } catch (error) {
    console.error('Error creating trip:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to create trip' }, { status: 500 });
  }
}
