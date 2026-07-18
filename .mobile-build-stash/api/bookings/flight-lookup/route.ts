import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/travelmanager/auth';
import { rateLimit } from '@/lib/rate-limit';
import { validateDateString } from '@/lib/sanitize';

function buildGoogleFlightsUrl(flightNumber: string): string {
  return `https://www.google.com/travel/flights?q=${encodeURIComponent(flightNumber)}`;
}

export async function GET(request: NextRequest) {
  try {
    const rateLimitResult = rateLimit(request, 'read');
    if (rateLimitResult) return rateLimitResult;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const flightNumber = request.nextUrl.searchParams.get('flight');
    const date = request.nextUrl.searchParams.get('date');

    if (!flightNumber || flightNumber.length < 3 || flightNumber.length > 10) {
      return NextResponse.json({ error: 'Valid flight number required (e.g., AA1234)' }, { status: 400 });
    }

    const cleaned = flightNumber.replace(/\s+/g, '').toUpperCase();
    const fallbackUrl = buildGoogleFlightsUrl(cleaned);

    if (!/^[A-Z0-9]{2}\d{1,4}$/.test(cleaned)) {
      return NextResponse.json({
        error: 'Invalid format. Use airline code + number (e.g., AA1234)',
        fallbackUrl,
      }, { status: 400 });
    }

    const apiKey = process.env.AERODATABOX_API_KEY;

    if (!apiKey) {
      return NextResponse.json({
        error: 'Flight lookup is not configured',
        fallbackUrl,
      }, { status: 503 });
    }

    if (!date || !validateDateString(date)) {
      return NextResponse.json({
        error: 'Valid date required (YYYY-MM-DD)',
        fallbackUrl,
      }, { status: 400 });
    }

    const res = await fetch(
      `https://aerodatabox.p.rapidapi.com/flights/number/${encodeURIComponent(cleaned)}/${encodeURIComponent(date)}`,
      {
        headers: {
          'x-rapidapi-host': 'aerodatabox.p.rapidapi.com',
          'x-rapidapi-key': apiKey,
        },
      }
    );

    if (!res.ok) {
      console.error('AeroDataBox API error:', res.status);
      return NextResponse.json({
        error: 'Flight data service unavailable',
        fallbackUrl,
      }, { status: 502 });
    }

    const data = await res.json();

    if (!Array.isArray(data) || data.length === 0) {
      return NextResponse.json({
        error: 'No flight found. Check the flight number and date.',
        fallbackUrl,
      }, { status: 404 });
    }

    const flight = data[0];

    const result = {
      airline: flight.airline?.name || '',
      flightNumber: flight.number || cleaned,
      departureAirport: flight.departure?.airport?.iata || '',
      departureCity: flight.departure?.airport?.name || '',
      arrivalAirport: flight.arrival?.airport?.iata || '',
      arrivalCity: flight.arrival?.airport?.name || '',
      departureTime: flight.departure?.scheduledTime?.local || '',
      arrivalTime: flight.arrival?.scheduledTime?.local || '',
      status: flight.status || '',
      fallbackUrl,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error looking up flight:', error instanceof Error ? error.message : error);
    const cleaned = (request.nextUrl.searchParams.get('flight') || '').replace(/\s+/g, '').toUpperCase();
    return NextResponse.json({
      error: 'Failed to fetch flight data',
      fallbackUrl: buildGoogleFlightsUrl(cleaned),
    }, { status: 500 });
  }
}
