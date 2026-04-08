import { describe, it, expect } from 'vitest';
import { validateEnum, sanitizeObject } from '@/lib/sanitize';

const BOOKING_STATUS_VALUES = ['ACTIVE', 'CANCELLED'] as const;
const BOOKING_ALLOWED_FIELDS = [
  'tripId', 'type', 'status', 'provider', 'confirmationNum',
  'startDateTime', 'endDateTime', 'location', 'endLocation',
  'seat', 'notes', 'commissionAmount', 'commissionRate',
  'commissionPaid', 'commissionNotes', 'timezone',
];

/** Pure helper that mirrors the toggle logic used in the UI */
function nextBookingStatus(current: string): 'ACTIVE' | 'CANCELLED' {
  return current === 'CANCELLED' ? 'ACTIVE' : 'CANCELLED';
}

describe('booking status validation', () => {
  it('accepts ACTIVE as a valid status', () => {
    expect(validateEnum('ACTIVE', BOOKING_STATUS_VALUES)).toBe(true);
  });

  it('accepts CANCELLED as a valid status', () => {
    expect(validateEnum('CANCELLED', BOOKING_STATUS_VALUES)).toBe(true);
  });

  it('rejects unknown status values', () => {
    expect(validateEnum('PENDING', BOOKING_STATUS_VALUES)).toBe(false);
    expect(validateEnum('DELETED', BOOKING_STATUS_VALUES)).toBe(false);
    expect(validateEnum('', BOOKING_STATUS_VALUES)).toBe(false);
  });

  it('is case-sensitive — lowercase is rejected', () => {
    expect(validateEnum('cancelled', BOOKING_STATUS_VALUES)).toBe(false);
    expect(validateEnum('active', BOOKING_STATUS_VALUES)).toBe(false);
  });
});

describe('cancel booking toggle logic', () => {
  it('transitions ACTIVE → CANCELLED', () => {
    expect(nextBookingStatus('ACTIVE')).toBe('CANCELLED');
  });

  it('transitions CANCELLED → ACTIVE (reactivate)', () => {
    expect(nextBookingStatus('CANCELLED')).toBe('ACTIVE');
  });

  it('treats any non-CANCELLED status as active', () => {
    // Default DB value is ACTIVE; any unexpected value should also cancel.
    expect(nextBookingStatus('UNKNOWN')).toBe('CANCELLED');
  });
});

describe('booking status in sanitized update payload', () => {
  it('preserves status field when updating a booking', () => {
    const payload = { status: 'CANCELLED', provider: 'Delta' };
    const sanitized = sanitizeObject(payload, BOOKING_ALLOWED_FIELDS);
    expect(sanitized).toHaveProperty('status', 'CANCELLED');
  });

  it('preserves ACTIVE status in sanitized payload', () => {
    const payload = { status: 'ACTIVE' };
    const sanitized = sanitizeObject(payload, BOOKING_ALLOWED_FIELDS);
    expect(sanitized).toHaveProperty('status', 'ACTIVE');
  });

  it('strips status if not in allowed fields', () => {
    const restrictedFields = ['provider', 'confirmationNum'];
    const payload = { status: 'CANCELLED', provider: 'Delta' };
    const sanitized = sanitizeObject(payload, restrictedFields);
    expect(sanitized).not.toHaveProperty('status');
    expect(sanitized).toHaveProperty('provider', 'Delta');
  });

  it('a cancel-only payload is sanitized correctly', () => {
    const payload = { status: 'CANCELLED' };
    const sanitized = sanitizeObject(payload, BOOKING_ALLOWED_FIELDS);
    expect(sanitized).toEqual({ status: 'CANCELLED' });
  });
});
