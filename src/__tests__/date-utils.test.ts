import { describe, it, expect } from 'vitest';
import { toLocalDateString, parseLocalDate, formatDateDisplay, formatDate, formatDateLong, formatDateShort } from '@/lib/date-utils';

describe('toLocalDateString', () => {
  it('formats a standard date as YYYY-MM-DD', () => {
    const date = new Date(2024, 0, 15); // Jan 15, 2024
    expect(toLocalDateString(date)).toBe('2024-01-15');
  });

  it('zero-pads single-digit month and day', () => {
    const date = new Date(2024, 2, 5); // Mar 5, 2024
    expect(toLocalDateString(date)).toBe('2024-03-05');
  });

  it('handles December 31 (last day of year)', () => {
    const date = new Date(2024, 11, 31);
    expect(toLocalDateString(date)).toBe('2024-12-31');
  });

  it('handles January 1 (first day of year)', () => {
    const date = new Date(2025, 0, 1);
    expect(toLocalDateString(date)).toBe('2025-01-01');
  });

  it('uses local time, not UTC — a late-night UTC date stays on the local day', () => {
    // Construct a date explicitly in local time; toLocalDateString should
    // return that same local day regardless of UTC offset.
    const date = new Date(2024, 5, 15); // Jun 15, 2024 local
    expect(toLocalDateString(date)).toBe('2024-06-15');
  });
});

describe('parseLocalDate', () => {
  it('parses a valid YYYY-MM-DD string into the correct local date', () => {
    const result = parseLocalDate('2024-07-04');
    expect(result).toBeInstanceOf(Date);
    expect(result!.getFullYear()).toBe(2024);
    expect(result!.getMonth()).toBe(6); // July is month index 6
    expect(result!.getDate()).toBe(4);
  });

  it('returns undefined for an empty string', () => {
    expect(parseLocalDate('')).toBeUndefined();
  });

  it('round-trips with toLocalDateString', () => {
    const original = '2025-12-25';
    const parsed = parseLocalDate(original)!;
    expect(toLocalDateString(parsed)).toBe(original);
  });

  it('parses dates without UTC midnight shift', () => {
    // The key purpose of parseLocalDate is to avoid the UTC midnight shift
    // that happens with new Date('2024-01-15'). Verify the day is correct.
    const result = parseLocalDate('2024-01-15');
    expect(result!.getDate()).toBe(15);
  });
});

describe('formatDateDisplay', () => {
  it('formats a date string as "Mon DD" (e.g. "Mar 15")', () => {
    expect(formatDateDisplay('2024-03-15')).toBe('Mar 15');
  });

  it('formats January 1', () => {
    expect(formatDateDisplay('2025-01-01')).toBe('Jan 1');
  });

  it('formats December 31', () => {
    expect(formatDateDisplay('2024-12-31')).toBe('Dec 31');
  });

  it('returns empty string for empty input', () => {
    expect(formatDateDisplay('')).toBe('');
  });
});

describe('formatDate', () => {
  it('formats an ISO string as "Mon DD, YYYY"', () => {
    expect(formatDate('2024-03-15')).toBe('Mar 15, 2024');
  });

  it('formats a Date object', () => {
    expect(formatDate(new Date(2024, 2, 15))).toBe('Mar 15, 2024');
  });

  it('handles ISO string with time part', () => {
    expect(formatDate('2024-03-15T14:30:00')).toBe('Mar 15, 2024');
  });

  it('returns null for null input', () => {
    expect(formatDate(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(formatDate(undefined)).toBeNull();
  });
});

describe('formatDateLong', () => {
  it('formats as "Month DD, YYYY"', () => {
    expect(formatDateLong('2024-03-15')).toBe('March 15, 2024');
  });

  it('formats a Date object', () => {
    expect(formatDateLong(new Date(Date.UTC(2024, 0, 1)))).toBe('January 1, 2024');
  });

  it('returns null for null input', () => {
    expect(formatDateLong(null)).toBeNull();
  });
});

describe('formatDateShort', () => {
  it('formats as "Mon DD" (no year)', () => {
    expect(formatDateShort('2024-03-15')).toBe('Mar 15');
  });

  it('formats a Date object', () => {
    expect(formatDateShort(new Date(Date.UTC(2024, 11, 25)))).toBe('Dec 25');
  });

  it('returns null for null input', () => {
    expect(formatDateShort(null)).toBeNull();
  });
});
