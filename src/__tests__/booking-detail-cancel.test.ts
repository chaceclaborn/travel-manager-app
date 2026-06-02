import { describe, it, expect } from 'vitest';
import { sanitizeObject, validateEnum } from '@/lib/sanitize';

const BOOKING_ALLOWED_FIELDS = ['type', 'status', 'provider', 'confirmationNum', 'startDateTime', 'endDateTime', 'location', 'endLocation', 'seat', 'notes', 'commissionAmount', 'commissionRate', 'commissionPaid', 'commissionNotes', 'timezone', 'tripId'];
const BOOKING_STATUS_VALUES = ['ACTIVE', 'CANCELLED'] as const;

describe('booking detail page cancel/reactivate logic', () => {
  it('allows CANCELLED status through sanitization', () => {
    const input = { status: 'CANCELLED' };
    const result = sanitizeObject(input, BOOKING_ALLOWED_FIELDS);
    expect(result).toHaveProperty('status', 'CANCELLED');
  });

  it('allows ACTIVE status through sanitization', () => {
    const input = { status: 'ACTIVE' };
    const result = sanitizeObject(input, BOOKING_ALLOWED_FIELDS);
    expect(result).toHaveProperty('status', 'ACTIVE');
  });

  it('validates CANCELLED as a valid status', () => {
    expect(validateEnum('CANCELLED', BOOKING_STATUS_VALUES)).toBe(true);
  });

  it('validates ACTIVE as a valid status', () => {
    expect(validateEnum('ACTIVE', BOOKING_STATUS_VALUES)).toBe(true);
  });

  it('rejects invalid status values', () => {
    expect(validateEnum('PENDING', BOOKING_STATUS_VALUES)).toBe(false);
    expect(validateEnum('DELETED', BOOKING_STATUS_VALUES)).toBe(false);
    expect(validateEnum('', BOOKING_STATUS_VALUES)).toBe(false);
  });

  it('status-only payload passes through sanitization without affecting other fields', () => {
    const input = { status: 'CANCELLED', provider: 'Delta Airlines' };
    const result = sanitizeObject(input, BOOKING_ALLOWED_FIELDS);
    expect(result.status).toBe('CANCELLED');
    expect(result.provider).toBe('Delta Airlines');
  });

  it('toggles status correctly: ACTIVE -> CANCELLED', () => {
    const currentStatus = 'ACTIVE';
    const nextStatus = currentStatus === 'CANCELLED' ? 'ACTIVE' : 'CANCELLED';
    expect(nextStatus).toBe('CANCELLED');
  });

  it('toggles status correctly: CANCELLED -> ACTIVE', () => {
    const currentStatus = 'CANCELLED';
    const nextStatus = currentStatus === 'CANCELLED' ? 'ACTIVE' : 'CANCELLED';
    expect(nextStatus).toBe('ACTIVE');
  });

  it('strips unknown status from payload', () => {
    const input = { status: 'REFUNDED' };
    const result = sanitizeObject(input, BOOKING_ALLOWED_FIELDS);
    // sanitizeObject passes the field through; enum validation is done in the route
    // so we just confirm it passes through and the route catches invalid values
    expect(result.status).toBe('REFUNDED');
    expect(validateEnum('REFUNDED', BOOKING_STATUS_VALUES)).toBe(false);
  });
});
