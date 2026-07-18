import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/travelmanager/auth';
import { rateLimit } from '@/lib/rate-limit';
import prisma from '@/lib/prisma';
import {
  normalizeUsername,
  validateUsername,
  isUsernameAvailable,
} from '@/lib/travelmanager/username';

export async function GET(request: NextRequest) {
  try {
    const rateLimitResult = rateLimit(request, 'read');
    if (rateLimitResult) return rateLimitResult;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const check = request.nextUrl.searchParams.get('check');
    if (!check) {
      return NextResponse.json({ error: 'Missing check parameter' }, { status: 400 });
    }

    const error = validateUsername(check);
    if (error) {
      return NextResponse.json({ available: false, error });
    }

    return NextResponse.json({ available: await isUsernameAvailable(check, user.id) });
  } catch (error) {
    console.error('Error checking username:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to check username' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const rateLimitResult = rateLimit(request, 'write');
    if (rateLimitResult) return rateLimitResult;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const body = await request.json();
    const raw = body?.username;

    if (!raw || typeof raw !== 'string') {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    const error = validateUsername(raw);
    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }

    const username = normalizeUsername(raw);

    try {
      const updated = await prisma.user.update({
        where: { id: user.id },
        data: { username },
      });
      return NextResponse.json({ user: updated });
    } catch (err) {
      if (err && typeof err === 'object' && 'code' in err && err.code === 'P2002') {
        return NextResponse.json({ error: 'That username is taken' }, { status: 409 });
      }
      throw err;
    }
  } catch (error) {
    console.error('Error updating username:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to update username' }, { status: 500 });
  }
}
