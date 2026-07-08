import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isApnsConfigured } from '@/lib/push/apns';
import { sendPushToUser } from '@/lib/push/dispatch';
import {
  selectDueReminders,
  type ReminderMeeting,
  type ReminderTrip,
} from '@/lib/push/reminders';

// Reads the DB and delivers via node:http2 — must run on the Node.js runtime,
// never cached.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DAY_MS = 86_400_000;

/** 'YYYY-MM-DD' key `offsetDays` from the UTC start of `now`. */
function utcDayKey(now: Date, offsetDays: number): string {
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return new Date(start + offsetDays * DAY_MS).toISOString().slice(0, 10);
}

/**
 * GET /api/cron/reminders
 *
 * Invoked once daily by Vercel Cron (see vercel.json). Scans for trips departing
 * soon and meetings coming up, then delivers a push per due item — deduped via
 * NotificationLog so a re-run in the same day never double-sends.
 *
 * Protected by CRON_SECRET: Vercel automatically sends `Authorization: Bearer
 * <CRON_SECRET>` on cron requests when that env var is set. Without a configured
 * + matching secret the endpoint refuses, so it can't be triggered by anyone.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization');
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Only claim + send when we can actually deliver. Otherwise we'd write
  // NotificationLog rows (marking reminders "sent") that never reached anyone,
  // permanently suppressing them once APNs is later configured.
  if (!isApnsConfigured()) {
    return NextResponse.json({ ok: true, skipped: 'apns_not_configured' });
  }

  try {
    const now = new Date();

    // Only bother with users who have at least one iOS device registered.
    const tokenUsers = await prisma.deviceToken.findMany({
      where: { platform: 'ios' },
      select: { userId: true },
      distinct: ['userId'],
    });
    const userIds = tokenUsers.map((t) => t.userId);
    if (userIds.length === 0) {
      return NextResponse.json({ ok: true, due: 0, sent: 0, note: 'no device tokens' });
    }

    // Candidate windows are deliberately wider than the lead days; the pure
    // selector below is authoritative about what's actually due.
    const tripWindowStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    );
    const tripWindowEnd = new Date(tripWindowStart.getTime() + 5 * DAY_MS);

    const [tripRows, meetingRows] = await Promise.all([
      prisma.trip.findMany({
        where: {
          userId: { in: userIds },
          status: { in: ['PLANNED', 'IN_PROGRESS'] },
          startDate: { gte: tripWindowStart, lt: tripWindowEnd },
        },
        select: { id: true, userId: true, title: true, destination: true, startDate: true },
      }),
      prisma.meeting.findMany({
        where: {
          userId: { in: userIds },
          // String range on ISO-prefixed values bounds by date; ±1 day of slack
          // absorbs timezone shifts. startDateTime is non-null in the schema.
          startDateTime: {
            gte: utcDayKey(now, -1),
            lte: `${utcDayKey(now, 2)}T23:59:59Z`,
          },
        },
        select: {
          id: true,
          userId: true,
          title: true,
          startDateTime: true,
          timezone: true,
          location: true,
        },
      }),
    ]);

    const trips: ReminderTrip[] = tripRows
      .filter((t): t is typeof t & { startDate: Date } => t.startDate !== null)
      .map((t) => ({
        id: t.id,
        userId: t.userId,
        title: t.title,
        destination: t.destination,
        startDate: t.startDate,
      }));

    const meetings: ReminderMeeting[] = meetingRows.map((m) => ({
      id: m.id,
      userId: m.userId,
      title: m.title,
      startDateTime: m.startDateTime,
      timezone: m.timezone,
      location: m.location,
    }));

    const due = selectDueReminders({ now, trips, meetings });

    let claimed = 0;
    let alreadySent = 0;
    let delivered = 0;

    for (const reminder of due) {
      // Claim first (at-most-once). A duplicate dedupKey throws P2002 → skip.
      try {
        await prisma.notificationLog.create({
          data: {
            userId: reminder.userId,
            type: reminder.type,
            dedupKey: reminder.dedupKey,
            entityId: reminder.entityId,
          },
        });
        claimed++;
      } catch (err) {
        if ((err as { code?: string }).code === 'P2002') {
          alreadySent++;
          continue;
        }
        throw err;
      }

      const result = await sendPushToUser(reminder.userId, {
        title: reminder.title,
        body: reminder.body,
        url: reminder.url,
        data: { type: reminder.type },
      });
      if (result.sent > 0) delivered++;
    }

    // Non-PII summary only.
    console.log('[cron/reminders] run', {
      users: userIds.length,
      due: due.length,
      claimed,
      alreadySent,
      delivered,
    });

    return NextResponse.json({
      ok: true,
      users: userIds.length,
      due: due.length,
      claimed,
      alreadySent,
      delivered,
    });
  } catch (error) {
    console.error(
      'Error running reminder cron:',
      error instanceof Error ? error.message : error
    );
    return NextResponse.json({ error: 'Reminder cron failed' }, { status: 500 });
  }
}
