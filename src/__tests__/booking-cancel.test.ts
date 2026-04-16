import { describe, it, expect } from 'vitest';
import { validateEnum } from '@/lib/sanitize';

// The two valid booking status values used throughout the app.
const BOOKING_STATUS_VALUES = ['ACTIVE', 'CANCELLED'] as const;
type BookingStatus = (typeof BOOKING_STATUS_VALUES)[number];

/**
 * Pure helper that mirrors the toggle logic in the booking list page and the
 * new cancel handler in the booking detail page:
 *   ACTIVE → CANCELLED  (user clicks Cancel)
 *   CANCELLED → ACTIVE  (user clicks Reactivate)
 */
function nextBookingStatus(current: BookingStatus): BookingStatus {
  return current === 'CANCELLED' ? 'ACTIVE' : 'CANCELLED';
}

describe('BookingStatus toggle logic', () => {
  it('toggles ACTIVE to CANCELLED', () => {
    expect(nextBookingStatus('ACTIVE')).toBe('CANCELLED');
  });

  it('toggles CANCELLED back to ACTIVE', () => {
    expect(nextBookingStatus('CANCELLED')).toBe('ACTIVE');
  });

  it('round-trips correctly (ACTIVE → CANCELLED → ACTIVE)', () => {
    const first = nextBookingStatus('ACTIVE');
    const second = nextBookingStatus(first);
    expect(second).toBe('ACTIVE');
  });

  it('round-trips correctly (CANCELLED → ACTIVE → CANCELLED)', () => {
    const first = nextBookingStatus('CANCELLED');
    const second = nextBookingStatus(first);
    expect(second).toBe('CANCELLED');
  });
});

describe('BookingStatus validation via validateEnum', () => {
  it('accepts ACTIVE as a valid status', () => {
    expect(validateEnum('ACTIVE', BOOKING_STATUS_VALUES)).toBe(true);
  });

  it('accepts CANCELLED as a valid status', () => {
    expect(validateEnum('CANCELLED', BOOKING_STATUS_VALUES)).toBe(true);
  });

  it('rejects an unknown status value', () => {
    expect(validateEnum('DELETED', BOOKING_STATUS_VALUES)).toBe(false);
  });

  it('is case-sensitive — lowercase active is rejected', () => {
    expect(validateEnum('active', BOOKING_STATUS_VALUES)).toBe(false);
  });

  it('is case-sensitive — lowercase cancelled is rejected', () => {
    expect(validateEnum('cancelled', BOOKING_STATUS_VALUES)).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(validateEnum('', BOOKING_STATUS_VALUES)).toBe(false);
  });

  it('rejects a numeric-looking string', () => {
    expect(validateEnum('1', BOOKING_STATUS_VALUES)).toBe(false);
  });
});
