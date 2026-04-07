import { describe, it, expect } from 'vitest';
import { sanitizeObject, validateEnum } from '@/lib/sanitize';

const BOOKING_STATUS_VALUES = ['ACTIVE', 'CANCELLED'] as const;

describe('booking cancellation — status enum validation', () => {
  it('accepts ACTIVE as a valid status', () => {
    expect(validateEnum('ACTIVE', BOOKING_STATUS_VALUES)).toBe(true);
  });

  it('accepts CANCELLED as a valid status', () => {
    expect(validateEnum('CANCELLED', BOOKING_STATUS_VALUES)).toBe(true);
  });

  it('rejects unknown status values', () => {
    expect(validateEnum('DELETED', BOOKING_STATUS_VALUES)).toBe(false);
    expect(validateEnum('PENDING', BOOKING_STATUS_VALUES)).toBe(false);
    expect(validateEnum('', BOOKING_STATUS_VALUES)).toBe(false);
  });

  it('is case-sensitive — rejects lowercase variants', () => {
    expect(validateEnum('cancelled', BOOKING_STATUS_VALUES)).toBe(false);
    expect(validateEnum('active', BOOKING_STATUS_VALUES)).toBe(false);
  });
});

describe('booking cancellation — sanitizeObject with status field', () => {
  const BOOKING_ALLOWED_FIELDS = ['tripId', 'type', 'status', 'provider', 'confirmationNum', 'startDateTime', 'endDateTime', 'location', 'endLocation', 'seat', 'notes'];

  it('passes status field through when whitelisted', () => {
    const result = sanitizeObject({ status: 'CANCELLED' }, BOOKING_ALLOWED_FIELDS);
    expect(result).toHaveProperty('status', 'CANCELLED');
  });

  it('passes ACTIVE status through', () => {
    const result = sanitizeObject({ status: 'ACTIVE' }, BOOKING_ALLOWED_FIELDS);
    expect(result).toHaveProperty('status', 'ACTIVE');
  });

  it('strips non-whitelisted fields alongside status', () => {
    const result = sanitizeObject({ status: 'CANCELLED', secret: 'injected' }, BOOKING_ALLOWED_FIELDS);
    expect(result).toHaveProperty('status', 'CANCELLED');
    expect(result).not.toHaveProperty('secret');
  });

  it('allows status update alongside other fields', () => {
    const result = sanitizeObject({ status: 'CANCELLED', notes: 'Cancelled by user' }, BOOKING_ALLOWED_FIELDS);
    expect(result).toHaveProperty('status', 'CANCELLED');
    expect(result).toHaveProperty('notes', 'Cancelled by user');
  });
});

describe('booking cancellation — toggle logic', () => {
  // Pure logic: determines new status based on current cancelled state
  function getNewStatus(currentlyCancelled: boolean): 'ACTIVE' | 'CANCELLED' {
    return currentlyCancelled ? 'ACTIVE' : 'CANCELLED';
  }

  it('cancels an active booking', () => {
    expect(getNewStatus(false)).toBe('CANCELLED');
  });

  it('restores a cancelled booking', () => {
    expect(getNewStatus(true)).toBe('ACTIVE');
  });

  it('correctly identifies a cancelled booking from status field', () => {
    const statuses: Array<'ACTIVE' | 'CANCELLED'> = ['ACTIVE', 'CANCELLED'];
    const isCancelledResults = statuses.map((s) => s === 'CANCELLED');
    expect(isCancelledResults).toEqual([false, true]);
  });
});
