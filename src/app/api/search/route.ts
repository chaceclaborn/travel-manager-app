import { NextRequest, NextResponse } from 'next/server';
import { searchAll } from '@/lib/travelmanager/trips';
import { requireAuth } from '@/lib/travelmanager/auth';
import { rateLimit } from '@/lib/rate-limit';
import { sanitizeString } from '@/lib/sanitize';

export async function GET(request: NextRequest) {
  try {
    const rateLimited = rateLimit(request, 'read');
    if (rateLimited) return rateLimited;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const rawQuery = request.nextUrl.searchParams.get('q')?.trim();
    if (!rawQuery || rawQuery.length < 2) {
      return NextResponse.json({ trips: [], vendors: [], clients: [] });
    }
    const q = sanitizeString(rawQuery);
    if (q.length < 2) {
      return NextResponse.json({ trips: [], vendors: [], clients: [] });
    }
    const results = await searchAll(q, user.id);
    return NextResponse.json(results);
  } catch (error) {
    console.error('Search error:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
