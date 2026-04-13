import { describe, it, expect } from 'vitest';
import { validateEnum } from '@/lib/sanitize';

// The booking status values accepted by the API
const BOOKING_STATUS_VALUES = ['ACTIVE', 'CANCELLED'] as const;

describe('booking status validation', () => {
  it('accepts ACTIVE as a valid status', () => {
    expect(validateEnum('ACTIVE', BOOKING_STATUS_VALUES)).toBe(true);
  });

  it('accepts CANCELLED as a valid status', () => {
    expect(validateEnum('CANCELLED', BOOKING_STATUS_VALUES)).toBe(true);
  });

  it('rejects an empty string', () => {
    expect(validateEnum('', BOOKING_STATUS_VALUES)).toBe(false);
  });

  it('rejects PENDING (not a valid booking status)', () => {
    expect(validateEnum('PENDING', BOOKING_STATUS_VALUES)).toBe(false);
  });

  it('rejects DELETED (not a valid booking status)', () => {
    expect(validateEnum('DELETED', BOOKING_STATUS_VALUES)).toBe(false);
  });

  it('is case-sensitive — rejects lowercase active', () => {
    expect(validateEnum('active', BOOKING_STATUS_VALUES)).toBe(false);
  });

  it('is case-sensitive — rejects lowercase cancelled', () => {
    expect(validateEnum('cancelled', BOOKING_STATUS_VALUES)).toBe(false);
  });
});

describe('cancel/reactivate toggle logic', () => {
  // Mirrors the logic used in BookingCard (bookings/page.tsx) and
  // BookingDetailPage (bookings/[id]/page.tsx) when the user clicks cancel/reactivate.
  function getNextStatus(currentStatus: 'ACTIVE' | 'CANCELLED'): 'ACTIVE' | 'CANCELLED' {
    return currentStatus === 'CANCELLED' ? 'ACTIVE' : 'CANCELLED';
  }

  it('cancels an active booking', () => {
    expect(getNextStatus('ACTIVE')).toBe('CANCELLED');
  });

  it('reactivates a cancelled booking', () => {
    expect(getNextStatus('CANCELLED')).toBe('ACTIVE');
  });

  it('toggle is its own inverse', () => {
    expect(getNextStatus(getNextStatus('ACTIVE'))).toBe('ACTIVE');
    expect(getNextStatus(getNextStatus('CANCELLED'))).toBe('CANCELLED');
  });
});
