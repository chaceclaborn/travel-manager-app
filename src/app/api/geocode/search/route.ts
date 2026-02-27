import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/travelmanager/auth';

export async function GET(request: NextRequest) {
  try {
    const { user, response } = await requireAuth();
    if (!user) return response;

    const q = request.nextUrl.searchParams.get('q');
    if (!q || q.length < 3) {
      return NextResponse.json([]);
    }

    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&addressdetails=1`,
      { headers: { 'User-Agent': 'TravelManager/1.0' } }
    );

    if (!res.ok) {
      return NextResponse.json({ error: 'Geocode service error' }, { status: 502 });
    }

    const data = await res.json();

    const results = data.map((item: Record<string, unknown>) => ({
      display_name: item.display_name as string,
      lat: item.lat as string,
      lon: item.lon as string,
      type: item.type as string,
      address: item.address as Record<string, string>,
    }));

    return NextResponse.json(results);
  } catch (error) {
    console.error('Geocode search error:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to search locations' }, { status: 500 });
  }
}
