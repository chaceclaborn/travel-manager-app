import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/travelmanager/admin';
import { rateLimit } from '@/lib/rate-limit';
import { sanitizeObject } from '@/lib/sanitize';
import { isApnsConfigured } from '@/lib/push/apns';
import { sendPushToUser } from '@/lib/push/dispatch';

// APNs delivery uses node:http2 + node:crypto — force the Node.js runtime so
// this never gets pushed onto the Edge runtime by a future default change.
export const runtime = 'nodejs';

/**
 * POST /api/push/send
 *
 * Sends a push notification to a target user's registered iOS devices. Admin
 * only — this is a "send push to another user" operation and must never be
 * exposed to arbitrary authenticated users. Used for manual/admin sends and as
 * the manually-invokable counterpart to the automated reminder cron.
 *
 * When APNs env vars are absent the route still succeeds but reports `stub:true`
 * so it can ship safely before certs are provisioned.
 *
 * Body: { userId: string, title: string, body?: string, url?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimited = rateLimit(request, 'sensitive');
    if (rateLimited) return rateLimited;

    const { user, response } = await requireAdmin();
    if (!user) return response;

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

    if (!isApnsConfigured()) {
      // Ship-safe path: no certs → report what WOULD have been targeted without
      // touching APNs. sendPushToUser also no-ops, but short-circuiting here
      // keeps the intent explicit.
      const result = await sendPushToUser(targetUserId, { title, body, url });
      return NextResponse.json({
        ok: true,
        stub: true,
        targeted: result.targeted,
        note: 'APNs not configured — dispatch skipped. Set APNS_* env vars to activate.',
      });
    }

    const result = await sendPushToUser(targetUserId, { title, body, url });

    // Log only non-PII metadata. title/body/url may contain booking details
    // (confirmation numbers, locations, client names) — keep them out of logs.
    console.log('[push/send] dispatch', {
      targetUserId,
      targeted: result.targeted,
      sent: result.sent,
      pruned: result.pruned,
    });

    return NextResponse.json({
      ok: true,
      targeted: result.targeted,
      sent: result.sent,
      pruned: result.pruned,
    });
  } catch (error) {
    console.error(
      'Error sending push:',
      error instanceof Error ? error.message : error
    );
    return NextResponse.json({ error: 'Failed to send push' }, { status: 500 });
  }
}
