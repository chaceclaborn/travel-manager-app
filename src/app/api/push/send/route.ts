import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/travelmanager/admin';
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

    const { user, response } = await requireAdmin();
    if (!user) return response;

    const raw = await request.json();
    const clean = sanitizeObject(raw, ['userId', 'title', 'body', 'url']);

    const targetUserId = typeof clean.userId === 'string' ? clean.userId : '';
    const title = typeof clean.title === 'string' ? clean.title : '';
    // body/url are parsed here so the sanitize contract stays stable for the
    // real dispatch, but we deliberately don't log them (PII — see below).
    const _body = typeof clean.body === 'string' ? clean.body : '';
    const _url = typeof clean.url === 'string' ? clean.url : undefined;
    void _body;
    void _url;

    if (!targetUserId || !title) {
      return NextResponse.json(
        { error: 'userId and title required' },
        { status: 400 }
      );
    }

    const tokens = await prisma.deviceToken.findMany({
      where: { userId: targetUserId },
      select: { id: true, token: true, platform: true },
    });

    // Log only non-PII metadata. `title`/`body`/`url` may contain booking
    // details (confirmation numbers, locations, client names) — Vercel log
    // retention + downstream log shipping would otherwise persist that as
    // a GDPR exposure. Keep this shape when the real APNs/FCM dispatch lands.
    console.log('[push/send] dispatch', {
      targetUserId,
      tokenCount: tokens.length,
    });

    // Real APNs dispatch is gated on env vars being present. This lets the
    // route ship safely in production with no certs — the stub path returns
    // `targeted` counts so the caller can tell what WOULD have been sent.
    //
    // To activate real delivery, provision in Apple Developer portal:
    //   APNS_KEY_ID       10-char key ID from the .p8 key
    //   APNS_TEAM_ID      10-char Apple team ID
    //   APNS_BUNDLE_ID    com.chaceclaborn.travelmanager
    //   APNS_KEY          contents of AuthKey_*.p8 (BEGIN/END PRIVATE KEY)
    //   APNS_HOST         api.push.apple.com (prod) / api.sandbox.push.apple.com (dev)
    // Then install `@parse/node-apn` (or roll our own HTTP/2 + ES256 JWT via
    // node:crypto) and replace the stub block below with a dispatch loop that
    // DELETEs any token Apple responds to with HTTP 410 (token invalid/expired).
    const certsConfigured = !!(
      process.env.APNS_KEY_ID &&
      process.env.APNS_TEAM_ID &&
      process.env.APNS_BUNDLE_ID &&
      process.env.APNS_KEY
    );

    if (!certsConfigured) {
      return NextResponse.json({
        ok: true,
        stub: true,
        targeted: tokens.length,
        note: 'APNs certs not configured — dispatch skipped. Set APNS_* env vars to activate.',
      });
    }

    // Scaffolding for the real path: iterate tokens, dispatch via APNs, prune
    // rejected tokens. Leaving unreachable for now — certs + package land first.
    const results: Array<{ token: string; ok: boolean; status?: number }> = [];
    for (const _row of tokens) {
      void _row;
      // const res = await sendApns(row.token, { title, body: _body, url: _url });
      // if (res.status === 410) await prisma.deviceToken.delete({ where: { id: row.id } });
      // results.push({ token: row.token.slice(0, 8) + '…', ok: res.ok, status: res.status });
    }

    return NextResponse.json({
      ok: true,
      stub: results.length === 0,
      targeted: tokens.length,
      results,
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
