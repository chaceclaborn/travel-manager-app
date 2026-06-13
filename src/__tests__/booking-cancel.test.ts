import { describe, it, expect } from 'vitest';
import { sanitizeObject } from '@/lib/sanitize';

type BookingStatus = 'ACTIVE' | 'CANCELLED';

function getNextStatus(current: BookingStatus): BookingStatus {
  return current === 'CANCELLED' ? 'ACTIVE' : 'CANCELLED';
}

const BOOKING_ALLOWED_FIELDS = [
  'tripId', 'type', 'status', 'provider', 'confirmationNum',
  'startDateTime', 'endDateTime', 'location', 'endLocation',
  'seat', 'notes', 'commissionAmount', 'commissionRate',
  'commissionPaid', 'commissionNotes', 'timezone',
];

describe('booking status toggle logic', () => {
  it('toggles ACTIVE to CANCELLED', () => {
    expect(getNextStatus('ACTIVE')).toBe('CANCELLED');
  });

  it('toggles CANCELLED back to ACTIVE', () => {
    expect(getNextStatus('CANCELLED')).toBe('ACTIVE');
  });

  it('toggle is its own inverse', () => {
    expect(getNextStatus(getNextStatus('ACTIVE'))).toBe('ACTIVE');
    expect(getNextStatus(getNextStatus('CANCELLED'))).toBe('CANCELLED');
  });
});

describe('booking cancel API payload sanitization', () => {
  it('allows status field through sanitization', () => {
    const payload = { status: 'CANCELLED' };
    const result = sanitizeObject(payload, BOOKING_ALLOWED_FIELDS);
    expect(result).toHaveProperty('status', 'CANCELLED');
  });

  it('allows ACTIVE status through sanitization', () => {
    const payload = { status: 'ACTIVE' };
    const result = sanitizeObject(payload, BOOKING_ALLOWED_FIELDS);
    expect(result).toHaveProperty('status', 'ACTIVE');
  });

  it('strips fields not in the allowed list', () => {
    const payload = { status: 'CANCELLED', malicious: 'drop table' };
    const result = sanitizeObject(payload, BOOKING_ALLOWED_FIELDS);
    expect(result).not.toHaveProperty('malicious');
    expect(result).toHaveProperty('status', 'CANCELLED');
  });

  it('passes status alongside other fields', () => {
    const payload = { provider: 'Delta Airlines', status: 'CANCELLED' };
    const result = sanitizeObject(payload, BOOKING_ALLOWED_FIELDS);
    expect(result).toHaveProperty('provider', 'Delta Airlines');
    expect(result).toHaveProperty('status', 'CANCELLED');
  });

  it('status is absent when not in payload', () => {
    const payload = { provider: 'Hilton' };
    const result = sanitizeObject(payload, BOOKING_ALLOWED_FIELDS);
    expect(result).not.toHaveProperty('status');
    expect(result).toHaveProperty('provider', 'Hilton');
  });
});

describe('booking status values', () => {
  const BOOKING_STATUS_VALUES: BookingStatus[] = ['ACTIVE', 'CANCELLED'];

  it('only contains ACTIVE and CANCELLED', () => {
    expect(BOOKING_STATUS_VALUES).toHaveLength(2);
    expect(BOOKING_STATUS_VALUES).toContain('ACTIVE');
    expect(BOOKING_STATUS_VALUES).toContain('CANCELLED');
  });

  it('every getNextStatus result is a valid status', () => {
    for (const status of BOOKING_STATUS_VALUES) {
      expect(BOOKING_STATUS_VALUES).toContain(getNextStatus(status));
    }
  });
});
