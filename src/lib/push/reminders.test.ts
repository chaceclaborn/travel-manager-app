import { describe, it, expect } from 'vitest';
import {
  selectDueReminders,
  type ReminderMeeting,
  type ReminderTrip,
} from './reminders';

const NOW = new Date('2026-07-07T12:00:00Z');

function trip(partial: Partial<ReminderTrip> & { id: string; startDate: Date }): ReminderTrip {
  return {
    userId: 'u1',
    title: 'Trip',
    destination: null,
    ...partial,
  };
}

function meeting(
  partial: Partial<ReminderMeeting> & { id: string; startDateTime: string }
): ReminderMeeting {
  return {
    userId: 'u1',
    title: 'Meeting',
    timezone: null,
    location: null,
    ...partial,
  };
}

describe('selectDueReminders — trips', () => {
  it('fires at 3 days and 1 day before departure, not at other offsets', () => {
    const due = selectDueReminders({
      now: NOW,
      trips: [
        trip({ id: 'in3', startDate: new Date('2026-07-10T00:00:00Z'), destination: 'Rome', title: 'Italy' }),
        trip({ id: 'in1', startDate: new Date('2026-07-08T00:00:00Z') }),
        trip({ id: 'in2', startDate: new Date('2026-07-09T00:00:00Z') }), // not a lead day
        trip({ id: 'past', startDate: new Date('2026-07-06T00:00:00Z') }),
      ],
      meetings: [],
    });

    const ids = due.map((d) => d.entityId).sort();
    expect(ids).toEqual(['in1', 'in3']);

    const in3 = due.find((d) => d.entityId === 'in3')!;
    expect(in3.type).toBe('trip_reminder');
    expect(in3.dedupKey).toBe('trip_reminder:in3:3');
    expect(in3.url).toBe('/trips/in3');
    expect(in3.body).toContain('Italy');
    expect(in3.body).toContain('to Rome');
    expect(in3.body).toContain('in 3 days');

    const in1 = due.find((d) => d.entityId === 'in1')!;
    expect(in1.dedupKey).toBe('trip_reminder:in1:1');
    expect(in1.title).toContain('tomorrow');
  });
});

describe('selectDueReminders — meetings', () => {
  it('fires for meetings today and tomorrow with a friendly time', () => {
    const due = selectDueReminders({
      now: NOW,
      trips: [],
      meetings: [
        meeting({ id: 'today', startDateTime: '2026-07-07T15:00', title: 'Kickoff', location: 'Zoom' }),
        meeting({ id: 'tomorrow', startDateTime: '2026-07-08T09:30' }),
        meeting({ id: 'in2', startDateTime: '2026-07-09T09:00' }), // out of range
      ],
    });

    const ids = due.map((d) => d.entityId).sort();
    expect(ids).toEqual(['today', 'tomorrow']);

    const today = due.find((d) => d.entityId === 'today')!;
    expect(today.type).toBe('meeting_reminder');
    expect(today.dedupKey).toBe('meeting_reminder:today:0');
    expect(today.title).toBe('Meeting today');
    expect(today.url).toBe('/meetings');
    expect(today.body).toContain('Kickoff');
    expect(today.body).toContain('3:00 PM');
    expect(today.body).toContain('Zoom');

    const tomorrow = due.find((d) => d.entityId === 'tomorrow')!;
    expect(tomorrow.dedupKey).toBe('meeting_reminder:tomorrow:1');
    expect(tomorrow.title).toBe('Meeting tomorrow');
    expect(tomorrow.body).toContain('9:30 AM');
  });

  it('honors the meeting timezone when deciding the local day', () => {
    // 23:00 UTC-7 (LA) on the 7th; "now" (05:00 LA) is the same local day → today.
    const due = selectDueReminders({
      now: NOW,
      trips: [],
      meetings: [
        meeting({
          id: 'la',
          startDateTime: '2026-07-07T23:00:00',
          timezone: 'America/Los_Angeles',
        }),
      ],
    });
    expect(due).toHaveLength(1);
    expect(due[0].dedupKey).toBe('meeting_reminder:la:0');
  });

  it('skips meetings with an unparseable start', () => {
    const due = selectDueReminders({
      now: NOW,
      trips: [],
      meetings: [meeting({ id: 'bad', startDateTime: 'not-a-date' })],
    });
    expect(due).toEqual([]);
  });
});

describe('selectDueReminders — empty', () => {
  it('returns nothing for no candidates', () => {
    expect(selectDueReminders({ now: NOW, trips: [], meetings: [] })).toEqual([]);
  });
});
