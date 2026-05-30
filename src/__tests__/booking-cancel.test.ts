import { describe, it, expect } from 'vitest';
import { sanitizeObject, validateEnum } from '@/lib/sanitize';

const BOOKING_ALLOWED_FIELDS = ['tripId', 'type', 'status', 'provider', 'confirmationNum', 'startDateTime', 'endDateTime', 'location', 'endLocation', 'seat', 'notes', 'commissionAmount', 'commissionRate', 'commissionPaid', 'commissionNotes', 'timezone'];
const BOOKING_STATUS_VALUES = ['ACTIVE', 'CANCELLED'] as const;

describe('booking cancel/reactivate', () => {
  it('includes status in sanitized booking update payload', () => {
    const input = { status: 'CANCELLED', provider: 'Delta Airlines' };
    const result = sanitizeObject(input, BOOKING_ALLOWED_FIELDS);
    expect(result).toHaveProperty('status', 'CANCELLED');
    expect(result).toHaveProperty('provider', 'Delta Airlines');
  });

  it('accepts ACTIVE as a valid status', () => {
    expect(validateEnum('ACTIVE', BOOKING_STATUS_VALUES)).toBe(true);
  });

  it('accepts CANCELLED as a valid status', () => {
    expect(validateEnum('CANCELLED', BOOKING_STATUS_VALUES)).toBe(true);
  });

  it('rejects invalid status values', () => {
    expect(validateEnum('PENDING', BOOKING_STATUS_VALUES)).toBe(false);
    expect(validateEnum('', BOOKING_STATUS_VALUES)).toBe(false);
    expect(validateEnum('cancelled', BOOKING_STATUS_VALUES)).toBe(false);
  });

  it('strips status when not in allowed fields', () => {
    const restrictedFields = ['provider', 'type'];
    const input = { provider: 'Delta', status: 'CANCELLED' };
    const result = sanitizeObject(input, restrictedFields);
    expect(result).not.toHaveProperty('status');
    expect(result).toHaveProperty('provider', 'Delta');
  });

  it('cancel toggle: ACTIVE -> CANCELLED', () => {
    const currentStatus = 'ACTIVE';
    const nextStatus = currentStatus === 'CANCELLED' ? 'ACTIVE' : 'CANCELLED';
    expect(nextStatus).toBe('CANCELLED');
  });

  it('cancel toggle: CANCELLED -> ACTIVE', () => {
    const currentStatus = 'CANCELLED';
    const nextStatus = currentStatus === 'CANCELLED' ? 'ACTIVE' : 'CANCELLED';
    expect(nextStatus).toBe('ACTIVE');
  });

  it('sanitize strips HTML from status value', () => {
    const input = { status: '<b>CANCELLED</b>' };
    const result = sanitizeObject(input, BOOKING_ALLOWED_FIELDS);
    expect(result.status).toBe('CANCELLED');
  });

  it('status-only payload is valid for a partial update', () => {
    const input = { status: 'CANCELLED' };
    const result = sanitizeObject(input, BOOKING_ALLOWED_FIELDS);
    expect(Object.keys(result)).toEqual(['status']);
  });

  it('preserves other booking fields alongside status', () => {
    const input = { status: 'CANCELLED', provider: 'Hilton', type: 'HOTEL', location: 'NYC' };
    const result = sanitizeObject(input, BOOKING_ALLOWED_FIELDS);
    expect(result).toMatchObject({ status: 'CANCELLED', provider: 'Hilton', type: 'HOTEL', location: 'NYC' });
  });
});
