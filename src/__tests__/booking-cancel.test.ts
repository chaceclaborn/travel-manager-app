/**
 * Booking cancellation logic tests.
 *
 * Verifies the status toggle logic and API payload shape used
 * by both the bookings list page and the booking detail page.
 */

import { describe, it, expect } from 'vitest';
import { validateEnum } from '@/lib/sanitize';

const BOOKING_STATUS_VALUES = ['ACTIVE', 'CANCELLED'] as const;
type BookingStatus = (typeof BOOKING_STATUS_VALUES)[number];

// Mirror of the toggle logic in the detail page's handleCancel
function nextBookingStatus(current: BookingStatus): BookingStatus {
  return current === 'CANCELLED' ? 'ACTIVE' : 'CANCELLED';
}

describe('booking cancellation status toggle', () => {
  it('toggles ACTIVE → CANCELLED', () => {
    expect(nextBookingStatus('ACTIVE')).toBe('CANCELLED');
  });

  it('toggles CANCELLED → ACTIVE (reactivation)', () => {
    expect(nextBookingStatus('CANCELLED')).toBe('ACTIVE');
  });

  it('double-toggle returns to original status', () => {
    expect(nextBookingStatus(nextBookingStatus('ACTIVE'))).toBe('ACTIVE');
    expect(nextBookingStatus(nextBookingStatus('CANCELLED'))).toBe('CANCELLED');
  });
});

describe('booking status validation via sanitize', () => {
  it('accepts ACTIVE as a valid booking status', () => {
    expect(validateEnum('ACTIVE', BOOKING_STATUS_VALUES)).toBe(true);
  });

  it('accepts CANCELLED as a valid booking status', () => {
    expect(validateEnum('CANCELLED', BOOKING_STATUS_VALUES)).toBe(true);
  });

  it('rejects an unknown status string', () => {
    expect(validateEnum('PENDING', BOOKING_STATUS_VALUES)).toBe(false);
  });

  it('rejects empty string', () => {
    expect(validateEnum('', BOOKING_STATUS_VALUES)).toBe(false);
  });

  it('is case-sensitive (lowercase rejected)', () => {
    expect(validateEnum('active', BOOKING_STATUS_VALUES)).toBe(false);
    expect(validateEnum('cancelled', BOOKING_STATUS_VALUES)).toBe(false);
  });
});

describe('cancel API payload shape', () => {
  it('produces correct body for cancelling an active booking', () => {
    const currentStatus: BookingStatus = 'ACTIVE';
    const payload = { status: nextBookingStatus(currentStatus) };
    expect(payload).toEqual({ status: 'CANCELLED' });
  });

  it('produces correct body for reactivating a cancelled booking', () => {
    const currentStatus: BookingStatus = 'CANCELLED';
    const payload = { status: nextBookingStatus(currentStatus) };
    expect(payload).toEqual({ status: 'ACTIVE' });
  });
});
