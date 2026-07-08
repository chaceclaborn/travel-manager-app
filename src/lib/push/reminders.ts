/**
 * Reminder selection — PURE. No DB, no network, no Date.now(): everything is
 * derived from the `now` argument so it's fully unit-testable. The cron route
 * (/api/cron/reminders) fetches candidate trips/meetings from the DB and hands
 * them here; this decides which ones are "due" today and produces the exact
 * notification text + a deterministic dedupKey per (event, entity, lead-time).
 *
 * Cadence is a once-daily digest, so everything is reasoned about at day
 * granularity — "departs in 3 days", "meeting is tomorrow" — never to the hour.
 */

/** Trip reminders fire this many days before departure (one push per lead day). */
export const TRIP_LEAD_DAYS = [3, 1] as const;
/** Meeting reminders fire this many days before the meeting (0 = same day). */
export const MEETING_LEAD_DAYS = [1, 0] as const;

export interface ReminderTrip {
  id: string;
  userId: string;
  title: string;
  destination: string | null;
  /** Trip start; callers filter out null startDates before passing them in. */
  startDate: Date;
}

export interface ReminderMeeting {
  id: string;
  userId: string;
  title: string;
  /** ISO-ish string of the meeting's local wall-clock start (app design). */
  startDateTime: string;
  timezone: string | null;
  location: string | null;
}

export interface DueReminder {
  userId: string;
  type: 'trip_reminder' | 'meeting_reminder';
  dedupKey: string;
  entityId: string;
  title: string;
  body: string;
  url: string;
}

export interface ReminderInput {
  now: Date;
  trips: ReminderTrip[];
  meetings: ReminderMeeting[];
}

const DAY_MS = 86_400_000;

/** 'YYYY-MM-DD' for a Date, in UTC. */
function utcDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** 'YYYY-MM-DD' for a Date, in the given IANA timezone. Falls back to UTC. */
function dateKeyInTz(d: Date, tz: string | null): string {
  if (!tz) return utcDateKey(d);
  try {
    // en-CA renders as YYYY-MM-DD.
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  } catch {
    return utcDateKey(d);
  }
}

/** Whole-day difference between two 'YYYY-MM-DD' keys (toKey - fromKey). */
function daysBetweenKeys(fromKey: string, toKey: string): number {
  const from = Date.parse(`${fromKey}T00:00:00Z`);
  const to = Date.parse(`${toKey}T00:00:00Z`);
  return Math.round((to - from) / DAY_MS);
}

/** The local wall-date ('YYYY-MM-DD') a meeting starts on, per its stored string. */
function meetingDateKey(startDateTime: string): string | null {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(startDateTime);
  if (m) return m[1];
  const parsed = new Date(startDateTime);
  return Number.isNaN(parsed.getTime()) ? null : utcDateKey(parsed);
}

/** A friendly "3:00 PM" from an ISO-ish string, or '' if no time is present. */
function friendlyTime(startDateTime: string): string {
  const m = /T(\d{2}):(\d{2})/.exec(startDateTime);
  if (!m) return '';
  let hour = Number(m[1]);
  const min = m[2];
  const ampm = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12 || 12;
  return `${hour}:${min} ${ampm}`;
}

/** "tomorrow" / "in 3 days" / "today". */
function whenPhrase(leadDays: number): string {
  if (leadDays <= 0) return 'today';
  if (leadDays === 1) return 'tomorrow';
  return `in ${leadDays} days`;
}

/**
 * Given "now" and the candidate trips/meetings, return every notification that
 * is due today. Deterministic and order-stable (trips first, then meetings, in
 * input order) so tests and dedup behavior are predictable.
 */
export function selectDueReminders(input: ReminderInput): DueReminder[] {
  const { now, trips, meetings } = input;
  const todayUtc = utcDateKey(now);
  const due: DueReminder[] = [];

  for (const trip of trips) {
    const diff = daysBetweenKeys(todayUtc, utcDateKey(trip.startDate));
    if (!TRIP_LEAD_DAYS.includes(diff as (typeof TRIP_LEAD_DAYS)[number])) continue;
    const where = trip.destination ? ` to ${trip.destination}` : '';
    due.push({
      userId: trip.userId,
      type: 'trip_reminder',
      dedupKey: `trip_reminder:${trip.id}:${diff}`,
      entityId: trip.id,
      title: diff === 1 ? 'Your trip departs tomorrow' : `Your trip departs in ${diff} days`,
      body: `${trip.title}${where} departs ${whenPhrase(diff)}.`,
      url: `/trips/${trip.id}`,
    });
  }

  for (const meeting of meetings) {
    const key = meetingDateKey(meeting.startDateTime);
    if (!key) continue;
    const todayLocal = dateKeyInTz(now, meeting.timezone);
    const diff = daysBetweenKeys(todayLocal, key);
    if (!MEETING_LEAD_DAYS.includes(diff as (typeof MEETING_LEAD_DAYS)[number])) continue;
    const time = friendlyTime(meeting.startDateTime);
    const at = time ? ` at ${time}` : '';
    const where = meeting.location ? ` · ${meeting.location}` : '';
    due.push({
      userId: meeting.userId,
      type: 'meeting_reminder',
      dedupKey: `meeting_reminder:${meeting.id}:${diff}`,
      entityId: meeting.id,
      title: diff === 0 ? 'Meeting today' : 'Meeting tomorrow',
      body: `${meeting.title} is ${whenPhrase(diff)}${at}${where}.`,
      url: '/meetings',
    });
  }

  return due;
}
