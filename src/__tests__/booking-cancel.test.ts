import { describe, it, expect } from 'vitest';
import { validateEnum } from '@/lib/sanitize';

const BOOKING_STATUS_VALUES = ['ACTIVE', 'CANCELLED'] as const;

describe('booking cancel — status validation', () => {
  it('accepts ACTIVE as a valid status', () => {
    expect(validateEnum('ACTIVE', BOOKING_STATUS_VALUES)).toBe(true);
  });

  it('accepts CANCELLED as a valid status', () => {
    expect(validateEnum('CANCELLED', BOOKING_STATUS_VALUES)).toBe(true);
  });

  it('rejects an unknown status string', () => {
    expect(validateEnum('PENDING', BOOKING_STATUS_VALUES)).toBe(false);
  });

  it('rejects empty string', () => {
    expect(validateEnum('', BOOKING_STATUS_VALUES)).toBe(false);
  });

  it('rejects lowercase variants', () => {
    expect(validateEnum('cancelled', BOOKING_STATUS_VALUES)).toBe(false);
    expect(validateEnum('active', BOOKING_STATUS_VALUES)).toBe(false);
  });
});

describe('booking cancel — toggle logic', () => {
  function nextStatus(current: 'ACTIVE' | 'CANCELLED'): 'ACTIVE' | 'CANCELLED' {
    return current === 'CANCELLED' ? 'ACTIVE' : 'CANCELLED';
  }

  it('toggles ACTIVE to CANCELLED', () => {
    expect(nextStatus('ACTIVE')).toBe('CANCELLED');
  });

  it('toggles CANCELLED back to ACTIVE', () => {
    expect(nextStatus('CANCELLED')).toBe('ACTIVE');
  });

  it('is its own inverse', () => {
    expect(nextStatus(nextStatus('ACTIVE'))).toBe('ACTIVE');
    expect(nextStatus(nextStatus('CANCELLED'))).toBe('CANCELLED');
  });
});
