import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/travelmanager/auth';
import { rateLimit } from '@/lib/rate-limit';
import { sanitizeString } from '@/lib/sanitize';
import { searchAll } from '@/lib/travelmanager/search';

const EMPTY = {
  trips: [],
  bookings: [],
  meetings: [],
  vendors: [],
  clients: [],
  itinerary: [],
};

export async function GET(request: NextRequest) {
  try {
    const limited = rateLimit(request, 'read');
    if (limited) return limited;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const rawQuery = new URL(request.url).searchParams.get('q') || '';
    const query = sanitizeString(rawQuery, 100);

    if (query.length < 2) {
      return NextResponse.json(EMPTY);
    }

    const results = await searchAll(user.id, query);
    return NextResponse.json(results);
  } catch (error) {
    console.error('Search error:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
