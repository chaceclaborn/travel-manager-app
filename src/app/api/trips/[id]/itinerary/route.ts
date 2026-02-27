import { NextRequest, NextResponse } from 'next/server';
import { getTripItinerary, createItineraryItem } from '@/lib/travelmanager/trips';
import { requireAuth } from '@/lib/travelmanager/auth';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id } = await params;
    const itinerary = await getTripItinerary(id, user.id);
    return NextResponse.json(itinerary);
  } catch (error) {
    console.error('Error fetching itinerary:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to fetch itinerary' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id } = await params;
    const body = await request.json();
    const { title, date, endDate, startTime, endTime, location, notes, sortOrder, vendorId, clientId } = body;

    if (!title || !date) {
      return NextResponse.json({ error: 'Title and date are required' }, { status: 400 });
    }

    const item = await createItineraryItem({
      tripId: id,
      title,
      date,
      endDate,
      startTime,
      endTime,
      location,
      notes,
      sortOrder,
      vendorId,
      clientId,
    }, user.id);
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error('Error creating itinerary item:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to create itinerary item' }, { status: 500 });
  }
}
