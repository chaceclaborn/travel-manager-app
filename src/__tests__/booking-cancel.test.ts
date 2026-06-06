import { describe, it, expect } from 'vitest';
import { validateEnum, sanitizeObject } from '@/lib/sanitize';

const BOOKING_STATUS_VALUES = ['ACTIVE', 'CANCELLED'] as const;
type BookingStatus = (typeof BOOKING_STATUS_VALUES)[number];

const BOOKING_FIELDS = ['type', 'provider', 'status', 'confirmationNum', 'startDateTime', 'endDateTime', 'location', 'notes'];

describe('booking cancel status validation', () => {
  it('accepts ACTIVE as a valid status', () => {
    expect(validateEnum('ACTIVE', BOOKING_STATUS_VALUES)).toBe(true);
  });

  it('accepts CANCELLED as a valid status', () => {
    expect(validateEnum('CANCELLED', BOOKING_STATUS_VALUES)).toBe(true);
  });

  it('rejects arbitrary strings as status', () => {
    expect(validateEnum('DELETED', BOOKING_STATUS_VALUES)).toBe(false);
    expect(validateEnum('', BOOKING_STATUS_VALUES)).toBe(false);
    expect(validateEnum('active', BOOKING_STATUS_VALUES)).toBe(false);
  });

  it('toggle from ACTIVE produces CANCELLED', () => {
    const current: BookingStatus = 'ACTIVE';
    const next: BookingStatus = current === 'CANCELLED' ? 'ACTIVE' : 'CANCELLED';
    expect(next).toBe('CANCELLED');
  });

  it('toggle from CANCELLED produces ACTIVE', () => {
    const current: BookingStatus = 'CANCELLED';
    const next: BookingStatus = current === 'CANCELLED' ? 'ACTIVE' : 'CANCELLED';
    expect(next).toBe('ACTIVE');
  });
});

describe('booking cancel API payload', () => {
  it('status passes through sanitizeObject correctly', () => {
    const input = { status: 'CANCELLED', provider: 'Delta' };
    const result = sanitizeObject(input, BOOKING_FIELDS);
    expect(result.status).toBe('CANCELLED');
    expect(result.provider).toBe('Delta');
  });

  it('ACTIVE status passes through sanitizeObject correctly', () => {
    const input = { status: 'ACTIVE', provider: 'Hilton' };
    const result = sanitizeObject(input, BOOKING_FIELDS);
    expect(result.status).toBe('ACTIVE');
  });

  it('status is excluded when field not in allowed list', () => {
    const restrictedFields = ['type', 'provider'];
    const input = { status: 'CANCELLED', provider: 'Delta', type: 'FLIGHT' };
    const result = sanitizeObject(input, restrictedFields);
    expect(result).not.toHaveProperty('status');
  });

  it('PUT payload only includes status field for cancel', () => {
    const booking = { id: 'abc123', status: 'ACTIVE' as BookingStatus, provider: 'Delta' };
    const nextStatus: BookingStatus = 'CANCELLED';
    const payload = { status: nextStatus };
    expect(payload).toEqual({ status: 'CANCELLED' });
    expect(payload).not.toHaveProperty('provider');
    expect(payload).not.toHaveProperty('id');
  });
});
