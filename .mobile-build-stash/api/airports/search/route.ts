import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/travelmanager/auth';
import { rateLimit } from '@/lib/rate-limit';
import airports from '@/data/airports.json';

export async function GET(request: NextRequest) {
  try {
    const rateLimitResult = rateLimit(request, 'read');
    if (rateLimitResult) return rateLimitResult;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const q = request.nextUrl.searchParams.get('q')?.trim() ?? '';
    if (q.length < 2) {
      return NextResponse.json({ error: 'Query must be at least 2 characters' }, { status: 400 });
    }

    const query = q.toUpperCase();
    const queryLower = q.toLowerCase();

    const exactIata: typeof airports = [];
    const startsWithIata: typeof airports = [];
    const startsWithNameOrCity: typeof airports = [];
    const includesMatch: typeof airports = [];

    for (const airport of airports) {
      const iata = airport.iata.toUpperCase();
      const name = airport.name.toLowerCase();
      const city = airport.city.toLowerCase();

      if (iata === query) {
        exactIata.push(airport);
      } else if (iata.startsWith(query)) {
        startsWithIata.push(airport);
      } else if (name.startsWith(queryLower) || city.startsWith(queryLower)) {
        startsWithNameOrCity.push(airport);
      } else if (iata.includes(query) || name.includes(queryLower) || city.includes(queryLower)) {
        includesMatch.push(airport);
      }
    }

    const results = [...exactIata, ...startsWithIata, ...startsWithNameOrCity, ...includesMatch].slice(0, 10);

    return NextResponse.json(results);
  } catch (error) {
    console.error('Error searching airports:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to search airports' }, { status: 500 });
  }
}
