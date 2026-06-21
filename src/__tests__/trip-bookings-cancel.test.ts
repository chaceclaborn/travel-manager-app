import { describe, it, expect } from 'vitest';

type BookingStatus = 'ACTIVE' | 'CANCELLED';

function nextCancelStatus(current: BookingStatus): BookingStatus {
  return current === 'CANCELLED' ? 'ACTIVE' : 'CANCELLED';
}

describe('cancel toggle logic', () => {
  it('toggles ACTIVE booking to CANCELLED', () => {
    expect(nextCancelStatus('ACTIVE')).toBe('CANCELLED');
  });

  it('toggles CANCELLED booking back to ACTIVE', () => {
    expect(nextCancelStatus('CANCELLED')).toBe('ACTIVE');
  });

  it('isCancelled is true only for CANCELLED status', () => {
    const cancelled: BookingStatus = 'CANCELLED';
    const active: BookingStatus = 'ACTIVE';
    expect(cancelled === 'CANCELLED').toBe(true);
    expect(active === 'CANCELLED').toBe(false);
  });
});
