import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/travelmanager/auth';
import { rateLimit } from '@/lib/rate-limit';
import { sanitizeString } from '@/lib/sanitize';

export async function GET() {
  try {
    const { user: authUser, response } = await requireAuth();
    if (!authUser) return response;

    const user = await prisma.user.findUnique({ where: { id: authUser.id } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Error fetching user profile:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to fetch user profile' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const rateLimited = rateLimit(request, 'write');
    if (rateLimited) return rateLimited;

    const { user: authUser, response } = await requireAuth();
    if (!authUser) return response;

    const body = await request.json();

    const data: Record<string, unknown> = {};

    if ('homeCity' in body) {
      data.homeCity = body.homeCity ? sanitizeString(String(body.homeCity)) : null;
    }

    if ('homeLatitude' in body) {
      if (body.homeLatitude === null) {
        data.homeLatitude = null;
      } else {
        const lat = Number(body.homeLatitude);
        if (isNaN(lat) || lat < -90 || lat > 90) {
          return NextResponse.json({ error: 'Invalid latitude (-90 to 90)' }, { status: 400 });
        }
        data.homeLatitude = lat;
      }
    }

    if ('homeLongitude' in body) {
      if (body.homeLongitude === null) {
        data.homeLongitude = null;
      } else {
        const lng = Number(body.homeLongitude);
        if (isNaN(lng) || lng < -180 || lng > 180) {
          return NextResponse.json({ error: 'Invalid longitude (-180 to 180)' }, { status: 400 });
        }
        data.homeLongitude = lng;
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const user = await prisma.user.update({
      where: { id: authUser.id },
      data,
    });

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Error updating user:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}
