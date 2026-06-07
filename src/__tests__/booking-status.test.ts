import { describe, it, expect } from 'vitest';
import { getNextBookingStatus } from '@/lib/travelmanager/booking-config';

describe('getNextBookingStatus', () => {
  it('returns CANCELLED when current status is ACTIVE', () => {
    expect(getNextBookingStatus('ACTIVE')).toBe('CANCELLED');
  });

  it('returns ACTIVE when current status is CANCELLED', () => {
    expect(getNextBookingStatus('CANCELLED')).toBe('ACTIVE');
  });

  it('toggling twice returns to original status', () => {
    const original = 'ACTIVE';
    const toggled = getNextBookingStatus(original);
    expect(getNextBookingStatus(toggled)).toBe(original);
  });

  it('toggling CANCELLED twice returns to CANCELLED', () => {
    const original = 'CANCELLED';
    const toggled = getNextBookingStatus(original);
    expect(getNextBookingStatus(toggled)).toBe(original);
  });
});
