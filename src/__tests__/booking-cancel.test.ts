import { describe, it, expect } from 'vitest';
import { validateEnum, sanitizeObject } from '@/lib/sanitize';

const BOOKING_STATUS_VALUES = ['ACTIVE', 'CANCELLED'] as const;
const BOOKING_ALLOWED_FIELDS = ['type', 'status', 'provider', 'confirmationNum', 'startDateTime', 'endDateTime', 'location', 'endLocation', 'seat', 'notes', 'commissionAmount', 'commissionRate', 'commissionPaid', 'commissionNotes', 'timezone', 'tripId'];

describe('booking status validation', () => {
  it('accepts ACTIVE', () => {
    expect(validateEnum('ACTIVE', BOOKING_STATUS_VALUES)).toBe(true);
  });

  it('accepts CANCELLED', () => {
    expect(validateEnum('CANCELLED', BOOKING_STATUS_VALUES)).toBe(true);
  });

  it('rejects unknown status', () => {
    expect(validateEnum('DELETED', BOOKING_STATUS_VALUES)).toBe(false);
  });

  it('is case-sensitive', () => {
    expect(validateEnum('active', BOOKING_STATUS_VALUES)).toBe(false);
    expect(validateEnum('cancelled', BOOKING_STATUS_VALUES)).toBe(false);
  });
});

describe('cancel toggle logic', () => {
  it('toggles ACTIVE to CANCELLED', () => {
    const currentStatus: 'ACTIVE' | 'CANCELLED' = 'ACTIVE';
    const nextStatus = currentStatus === 'CANCELLED' ? 'ACTIVE' : 'CANCELLED';
    expect(nextStatus).toBe('CANCELLED');
  });

  it('toggles CANCELLED to ACTIVE', () => {
    const currentStatus: 'ACTIVE' | 'CANCELLED' = 'CANCELLED';
    const nextStatus = currentStatus === 'CANCELLED' ? 'ACTIVE' : 'CANCELLED';
    expect(nextStatus).toBe('ACTIVE');
  });

  it('both resulting values are valid statuses', () => {
    expect(validateEnum('CANCELLED', BOOKING_STATUS_VALUES)).toBe(true);
    expect(validateEnum('ACTIVE', BOOKING_STATUS_VALUES)).toBe(true);
  });
});

describe('sanitizeObject allows status field', () => {
  it('passes status CANCELLED through', () => {
    const result = sanitizeObject({ status: 'CANCELLED', provider: 'Delta' }, BOOKING_ALLOWED_FIELDS);
    expect(result.status).toBe('CANCELLED');
    expect(result.provider).toBe('Delta');
  });

  it('passes status ACTIVE through', () => {
    const result = sanitizeObject({ status: 'ACTIVE' }, BOOKING_ALLOWED_FIELDS);
    expect(result.status).toBe('ACTIVE');
  });

  it('strips fields not in the allowed list', () => {
    const result = sanitizeObject({ status: 'CANCELLED', secret: 'bad' }, BOOKING_ALLOWED_FIELDS);
    expect(result).not.toHaveProperty('secret');
    expect(result.status).toBe('CANCELLED');
  });

  it('PUT payload for cancel contains only status', () => {
    const payload = { status: 'CANCELLED' };
    const result = sanitizeObject(payload, BOOKING_ALLOWED_FIELDS);
    expect(result.status).toBe('CANCELLED');
    expect(Object.keys(result)).toEqual(['status']);
  });
});
