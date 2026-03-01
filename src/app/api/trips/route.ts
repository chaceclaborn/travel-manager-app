import { NextRequest, NextResponse } from 'next/server';
import { getTrips, createTrip } from '@/lib/travelmanager/trips';
import { requireAuth } from '@/lib/travelmanager/auth';
import { rateLimit } from '@/lib/rate-limit';
import { sanitizeObject, validateDateString, validateEnum, TRIP_STATUS_VALUES, TRANSPORT_MODE_VALUES } from '@/lib/sanitize';

export async function GET(request: NextRequest) {
  try {
    const rateLimitResult = rateLimit(request, 'read');
    if (rateLimitResult) return rateLimitResult;

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
    const rateLimitResult = rateLimit(request, 'write');
    if (rateLimitResult) return rateLimitResult;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const body = await request.json();
    const sanitized = sanitizeObject(body, ['title', 'destination', 'startDate', 'endDate', 'status', 'notes', 'budget', 'transportMode', 'departureAirportCode', 'departureAirportName', 'departureAirportLat', 'departureAirportLng', 'arrivalAirportCode', 'arrivalAirportName', 'arrivalAirportLat', 'arrivalAirportLng']);
    const { title, destination, startDate, endDate, status, notes, budget, transportMode, departureAirportCode, departureAirportLat, departureAirportLng, arrivalAirportCode, arrivalAirportLat, arrivalAirportLng } = sanitized;

    if (!title || typeof title !== 'string') {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    if (status && !validateEnum(status as string, TRIP_STATUS_VALUES)) {
      return NextResponse.json({ error: 'Invalid trip status' }, { status: 400 });
    }

    if (transportMode && !validateEnum(transportMode as string, TRANSPORT_MODE_VALUES)) {
      return NextResponse.json({ error: 'Invalid transport mode' }, { status: 400 });
    }

    if (startDate && !validateDateString(startDate as string)) {
      return NextResponse.json({ error: 'Invalid start date format' }, { status: 400 });
    }

    if (endDate && !validateDateString(endDate as string)) {
      return NextResponse.json({ error: 'Invalid end date format' }, { status: 400 });
    }

    if (budget !== undefined && budget !== null && (typeof budget !== 'number' || budget < 0)) {
      return NextResponse.json({ error: 'Budget must be a non-negative number' }, { status: 400 });
    }

    if (status !== 'DRAFT' && (!destination || !startDate || !endDate)) {
      return NextResponse.json({ error: 'Destination, start date, and end date are required for non-draft trips' }, { status: 400 });
    }

    if (status !== 'DRAFT' && transportMode === 'FLIGHT' && (!departureAirportCode || !arrivalAirportCode)) {
      return NextResponse.json({ error: 'Departure and arrival airports are required for flight trips' }, { status: 400 });
    }

    if ((departureAirportLat !== undefined && departureAirportLat !== null && typeof departureAirportLat !== 'number') ||
        (departureAirportLng !== undefined && departureAirportLng !== null && typeof departureAirportLng !== 'number') ||
        (arrivalAirportLat !== undefined && arrivalAirportLat !== null && typeof arrivalAirportLat !== 'number') ||
        (arrivalAirportLng !== undefined && arrivalAirportLng !== null && typeof arrivalAirportLng !== 'number')) {
      return NextResponse.json({ error: 'Airport coordinates must be valid numbers' }, { status: 400 });
    }

    const trip = await createTrip(sanitized as unknown as Parameters<typeof createTrip>[0], user.id);
    return NextResponse.json(trip, { status: 201 });
  } catch (error) {
    console.error('Error creating trip:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to create trip' }, { status: 500 });
  }
}
