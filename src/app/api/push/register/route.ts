import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/travelmanager/auth';
import { rateLimit } from '@/lib/rate-limit';
import { sanitizeObject } from '@/lib/sanitize';
import prisma from '@/lib/prisma';

/**
 * POST /api/push/register
 *
 * Registers a push notification device token for the authenticated user.
 * Idempotent: if the token already exists (same device re-registering), we
 * upsert it and re-associate it with the current user.
 *
 * Body: { token: string, platform: 'ios' | 'web' }
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimited = rateLimit(request, 'write');
    if (rateLimited) return rateLimited;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const body = await request.json();
    const clean = sanitizeObject(body, ['token', 'platform']);

    const token = typeof clean.token === 'string' ? clean.token : '';
    const platform = typeof clean.platform === 'string' ? clean.platform : '';

    if (!token || token.length < 10) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
    }
    if (platform !== 'ios' && platform !== 'web') {
      return NextResponse.json({ error: 'Invalid platform' }, { status: 400 });
    }

    // Look up first so we can reject token hijacks. If the token already
    // exists under a different user, refuse — this prevents an authenticated
    // attacker who happens to obtain another user's APNs token from taking
    // over its push delivery. Same-owner re-registration is still idempotent.
    const existing = await prisma.deviceToken.findUnique({
      where: { token },
      select: { id: true, userId: true },
    });

    if (existing && existing.userId !== user.id) {
      return NextResponse.json({ error: 'Token already registered' }, { status: 409 });
    }

    const record = existing
      ? await prisma.deviceToken.update({
          where: { id: existing.id },
          data: { platform },
        })
      : await prisma.deviceToken.create({
          data: { userId: user.id, token, platform },
        });

    return NextResponse.json({ ok: true, id: record.id });
  } catch (error) {
    console.error(
      'Error registering push token:',
      error instanceof Error ? error.message : error
    );
    return NextResponse.json(
      { error: 'Failed to register device token' },
      { status: 500 }
    );
  }
}
