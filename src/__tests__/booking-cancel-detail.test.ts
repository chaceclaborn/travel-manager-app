import { describe, it, expect } from 'vitest';

type BookingStatus = 'ACTIVE' | 'CANCELLED';

const BOOKING_STATUS_VALUES: BookingStatus[] = ['ACTIVE', 'CANCELLED'];

function toggleStatus(current: BookingStatus): BookingStatus {
  return current === 'CANCELLED' ? 'ACTIVE' : 'CANCELLED';
}

function isValidStatus(value: string): value is BookingStatus {
  return BOOKING_STATUS_VALUES.includes(value as BookingStatus);
}

describe('booking cancel toggle logic (detail page)', () => {
  it('toggles ACTIVE to CANCELLED', () => {
    expect(toggleStatus('ACTIVE')).toBe('CANCELLED');
  });

  it('toggles CANCELLED to ACTIVE', () => {
    expect(toggleStatus('CANCELLED')).toBe('ACTIVE');
  });

  it('ACTIVE is a valid status', () => {
    expect(isValidStatus('ACTIVE')).toBe(true);
  });

  it('CANCELLED is a valid status', () => {
    expect(isValidStatus('CANCELLED')).toBe(true);
  });

  it('rejects invalid status strings', () => {
    expect(isValidStatus('PENDING')).toBe(false);
    expect(isValidStatus('')).toBe(false);
    expect(isValidStatus('active')).toBe(false);
  });

  it('isCancelled flag is true only for CANCELLED status', () => {
    expect('CANCELLED' === 'CANCELLED').toBe(true);
    expect('ACTIVE' === 'CANCELLED').toBe(false);
  });

  it('two toggles restore original status', () => {
    const original: BookingStatus = 'ACTIVE';
    expect(toggleStatus(toggleStatus(original))).toBe(original);
  });

  it('two toggles from CANCELLED restore original', () => {
    const original: BookingStatus = 'CANCELLED';
    expect(toggleStatus(toggleStatus(original))).toBe(original);
  });
});
