import { describe, it, expect } from 'vitest';
import { validateEnum, sanitizeObject } from '@/lib/sanitize';

const BOOKING_STATUS_VALUES = ['ACTIVE', 'CANCELLED'] as const;
const BOOKING_ALLOWED_FIELDS = [
  'tripId', 'type', 'status', 'provider', 'confirmationNum',
  'startDateTime', 'endDateTime', 'location', 'endLocation',
  'seat', 'notes', 'timezone',
];

describe('booking cancel — status validation', () => {
  it('accepts CANCELLED as a valid booking status', () => {
    expect(validateEnum('CANCELLED', BOOKING_STATUS_VALUES)).toBe(true);
  });

  it('accepts ACTIVE as a valid booking status', () => {
    expect(validateEnum('ACTIVE', BOOKING_STATUS_VALUES)).toBe(true);
  });

  it('rejects unknown status values', () => {
    expect(validateEnum('DELETED', BOOKING_STATUS_VALUES)).toBe(false);
    expect(validateEnum('cancelled', BOOKING_STATUS_VALUES)).toBe(false);
    expect(validateEnum('', BOOKING_STATUS_VALUES)).toBe(false);
  });

  it('sanitizeObject passes status through the allowed-field whitelist', () => {
    const body = { status: 'CANCELLED', provider: 'Delta' };
    const result = sanitizeObject(body, BOOKING_ALLOWED_FIELDS);
    expect(result).toHaveProperty('status', 'CANCELLED');
  });

  it('sanitizeObject strips status when not in allowed fields', () => {
    const restrictedFields = ['provider', 'notes'];
    const body = { status: 'CANCELLED', provider: 'Delta' };
    const result = sanitizeObject(body, restrictedFields);
    expect(result).not.toHaveProperty('status');
    expect(result).toHaveProperty('provider', 'Delta');
  });

  it('sanitizeObject round-trips ACTIVE status correctly', () => {
    const body = { status: 'ACTIVE', provider: 'Hilton' };
    const result = sanitizeObject(body, BOOKING_ALLOWED_FIELDS);
    expect(result.status).toBe('ACTIVE');
  });

  it('sanitizeObject strips disallowed fields alongside status', () => {
    const body = { status: 'CANCELLED', provider: 'Delta', __proto__: 'evil', malicious: 'payload' };
    const result = sanitizeObject(body, BOOKING_ALLOWED_FIELDS);
    expect(result).toHaveProperty('status', 'CANCELLED');
    expect(result).toHaveProperty('provider', 'Delta');
    expect(result).not.toHaveProperty('malicious');
    expect(result).not.toHaveProperty('__proto__');
  });
});
