import { NextRequest, NextResponse } from 'next/server';
import { getStops, createStop } from '@/lib/travelmanager/stops';
import { requireAuth } from '@/lib/travelmanager/auth';
import { rateLimit } from '@/lib/rate-limit';
import { sanitizeObject, validateUUID, validateDateString } from '@/lib/sanitize';

const STOP_ALLOWED_FIELDS = ['name', 'latitude', 'longitude', 'date', 'notes'];

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const rateLimited = rateLimit(request, 'read');
    if (rateLimited) return rateLimited;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id } = await params;
    if (!validateUUID(id)) {
      return NextResponse.json({ error: 'Invalid trip ID' }, { status: 400 });
    }
    const stops = await getStops(id, user.id);
    return NextResponse.json(stops);
  } catch (error) {
    console.error('Error fetching stops:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to fetch stops' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const rateLimited = rateLimit(request, 'write');
    if (rateLimited) return rateLimited;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id: tripId } = await params;
    if (!validateUUID(tripId)) {
      return NextResponse.json({ error: 'Invalid trip ID' }, { status: 400 });
    }

    const body = await request.json();
    const sanitized = sanitizeObject(body, STOP_ALLOWED_FIELDS);

    const name = typeof sanitized.name === 'string' ? sanitized.name.trim() : '';
    if (!name || name.length > 200) {
      return NextResponse.json({ error: 'Invalid stop name' }, { status: 400 });
    }

    const latitude = Number(sanitized.latitude);
    const longitude = Number(sanitized.longitude);
    if (
      !Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
      !Number.isFinite(longitude) || longitude < -180 || longitude > 180
    ) {
      return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 });
    }

    if (sanitized.date && !validateDateString(sanitized.date as string)) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
    }

    const stop = await createStop(
      {
        tripId,
        name,
        latitude,
        longitude,
        date: (sanitized.date as string) || null,
        notes: (sanitized.notes as string) || null,
      },
      user.id
    );
    return NextResponse.json(stop, { status: 201 });
  } catch (error) {
    console.error('Error creating stop:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to create stop' }, { status: 500 });
  }
}
