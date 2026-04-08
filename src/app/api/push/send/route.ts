import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/travelmanager/auth';
import { rateLimit } from '@/lib/rate-limit';
import { sanitizeObject } from '@/lib/sanitize';
import prisma from '@/lib/prisma';

/**
 * POST /api/push/send  —  STUB
 *
 * Accepts { userId, title, body, url } and (for now) just logs the intent
 * and returns the list of device tokens that WOULD have been notified.
 *
 * Real APNs / FCM delivery is a follow-up once the user has signing certs
 * provisioned in the Apple Developer portal. Once that's ready, swap the
 * logging below for an actual dispatch loop — probably via:
 *   - APNs HTTP/2 (native iOS): https://developer.apple.com/documentation/usernotifications/setting_up_a_remote_notification_server
 *   - Firebase Cloud Messaging (web + iOS via APNs): https://firebase.google.com/docs/cloud-messaging/migrate-v1
 *
 * For the scaffolding stage we keep this route auth'd and rate-limited so
 * the shape of the API is already correct when the real integration lands.
 *
 * Gated to admins only for now — this is a "send push to another user"
 * operation which should never be exposed to arbitrary authenticated users.
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimited = rateLimit(request, 'sensitive');
    if (rateLimited) return rateLimited;

    const { user, response } = await requireAuth();
    if (!user) return response;

    // Admin gate: only the configured admin email can trigger sends in the
    // stub. When the real APNs integration lands, this will likely be
    // replaced with an internal/system call rather than an HTTP route.
    if (user.email !== process.env.ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const raw = await request.json();
    const clean = sanitizeObject(raw, ['userId', 'title', 'body', 'url']);

    const targetUserId = typeof clean.userId === 'string' ? clean.userId : '';
    const title = typeof clean.title === 'string' ? clean.title : '';
    const body = typeof clean.body === 'string' ? clean.body : '';
    const url = typeof clean.url === 'string' ? clean.url : undefined;

    if (!targetUserId || !title) {
      return NextResponse.json(
        { error: 'userId and title required' },
        { status: 400 }
      );
    }

    const tokens = await prisma.deviceToken.findMany({
      where: { userId: targetUserId },
      select: { token: true, platform: true },
    });

    console.log('[push/send] STUB dispatch', {
      targetUserId,
      title,
      body,
      url,
      tokenCount: tokens.length,
    });

    // TODO: real APNs/FCM dispatch once signing certs are provisioned.

    return NextResponse.json({
      ok: true,
      stub: true,
      targeted: tokens.length,
    });
  } catch (error) {
    console.error(
      'Error sending push:',
      error instanceof Error ? error.message : error
    );
    return NextResponse.json(
      { error: 'Failed to send push' },
      { status: 500 }
    );
  }
}
