/**
 * High-level push dispatch — SERVER ONLY.
 *
 * The single reusable "send a notification to a user" primitive that every
 * server-side trigger (admin /api/push/send, the reminder cron, booking
 * confirmations) calls. It:
 *   1. looks up the user's iOS device tokens,
 *   2. no-ops safely when APNs isn't configured or the user has no tokens,
 *   3. delivers via {@link sendApns}, and
 *   4. prunes any token APNs reports as dead (410 / BadDeviceToken) so the
 *      DeviceToken table doesn't rot.
 */

import prisma from '@/lib/prisma';
import {
  getApnsConfig,
  isApnsConfigured,
  isTokenDead,
  sendApns,
  type ApnsResult,
} from './apns';

export interface SendPushMessage {
  title: string;
  body: string;
  /** Deep-link path the app opens when the notification is tapped, e.g. `/trips/abc`. */
  url?: string;
  /** Extra custom payload keys (merged with `url`). */
  data?: Record<string, unknown>;
}

export interface SendPushResult {
  /** Whether APNs credentials are present. False → nothing was attempted. */
  configured: boolean;
  /** Number of device tokens the user has. */
  targeted: number;
  /** Number of tokens APNs accepted (status 200). */
  sent: number;
  /** Number of dead tokens deleted as a result of this send. */
  pruned: number;
}

/**
 * Send a push notification to every iOS device registered to `userId`.
 * Never throws — delivery failures are reported in the result, so callers can
 * safely fire this alongside a user-facing mutation without risking the request.
 */
export async function sendPushToUser(
  userId: string,
  msg: SendPushMessage
): Promise<SendPushResult> {
  const config = getApnsConfig();

  const rows = await prisma.deviceToken.findMany({
    where: { userId, platform: 'ios' },
    select: { id: true, token: true },
  });

  if (!config || rows.length === 0) {
    return { configured: !!config, targeted: rows.length, sent: 0, pruned: 0 };
  }

  const data: Record<string, unknown> = {
    ...(msg.data ?? {}),
    ...(msg.url ? { url: msg.url } : {}),
  };

  let results: ApnsResult[];
  try {
    results = await sendApns(
      rows.map((r) => r.token),
      { title: msg.title, body: msg.body, data },
      config
    );
  } catch (err) {
    console.error(
      '[push] APNs dispatch failed:',
      err instanceof Error ? err.message : err
    );
    return { configured: true, targeted: rows.length, sent: 0, pruned: 0 };
  }

  const idByToken = new Map(rows.map((r) => [r.token, r.id]));
  const deadIds: string[] = [];
  let sent = 0;
  for (const r of results) {
    if (r.ok) {
      sent++;
    } else if (isTokenDead(r)) {
      const id = idByToken.get(r.token);
      if (id) deadIds.push(id);
    }
  }

  if (deadIds.length > 0) {
    await prisma.deviceToken
      .deleteMany({ where: { id: { in: deadIds } } })
      .catch(() => {
        /* pruning is best-effort */
      });
  }

  return { configured: true, targeted: rows.length, sent, pruned: deadIds.length };
}

/** Minimal shape of a Booking needed to compose its confirmation notification. */
interface BookingLike {
  userId: string;
  type: string;
  provider: string;
  confirmationNum?: string | null;
  tripId?: string | null;
}

/**
 * Fire a "booking confirmed" push to the owner right after they add a booking.
 * Best-effort and cheap when unconfigured — safe to await inside the create path.
 */
export async function notifyBookingConfirmed(booking: BookingLike): Promise<void> {
  // Skip the device-token lookup entirely when push isn't configured — keeps
  // the booking-create path free of an extra query in that (current) state.
  if (!isApnsConfigured()) return;

  const typeLabel = BOOKING_TYPE_LABELS[booking.type] ?? 'Booking';
  const confirmation = booking.confirmationNum
    ? ` · confirmation ${booking.confirmationNum}`
    : '';
  await sendPushToUser(booking.userId, {
    title: `${typeLabel} confirmed`,
    body: `${booking.provider}${confirmation} has been added to your bookings.`,
    url: booking.tripId ? `/trips/${booking.tripId}` : '/bookings',
    data: { type: 'booking_confirmation' },
  }).catch(() => {
    /* never let a notification failure surface to the booking flow */
  });
}

const BOOKING_TYPE_LABELS: Record<string, string> = {
  FLIGHT: 'Flight',
  HOTEL: 'Hotel',
  CAR_RENTAL: 'Car rental',
  TRAIN: 'Train',
  BUS: 'Bus',
  OTHER: 'Booking',
};
