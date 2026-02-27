import { NextRequest, NextResponse } from 'next/server';
import { searchAll } from '@/lib/travelmanager/trips';
import { requireAuth } from '@/lib/travelmanager/auth';

export async function GET(request: NextRequest) {
  try {
    const { user, response } = await requireAuth();
    if (!user) return response;

    const q = request.nextUrl.searchParams.get('q')?.trim();
    if (!q || q.length < 2) {
      return NextResponse.json({ trips: [], vendors: [], clients: [] });
    }
    const results = await searchAll(q, user.id);
    return NextResponse.json(results);
  } catch (error) {
    console.error('Search error:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
