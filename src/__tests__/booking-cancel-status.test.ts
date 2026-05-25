import { describe, it, expect } from 'vitest';

type BookingStatus = 'ACTIVE' | 'CANCELLED';

function getNextCancelStatus(current: BookingStatus): BookingStatus {
  return current === 'CANCELLED' ? 'ACTIVE' : 'CANCELLED';
}

function isCancelledStatus(status: BookingStatus): boolean {
  return status === 'CANCELLED';
}

describe('booking cancel status toggle', () => {
  it('returns CANCELLED when current status is ACTIVE', () => {
    expect(getNextCancelStatus('ACTIVE')).toBe('CANCELLED');
  });

  it('returns ACTIVE when current status is CANCELLED', () => {
    expect(getNextCancelStatus('CANCELLED')).toBe('ACTIVE');
  });

  it('toggling twice returns to original status', () => {
    const original: BookingStatus = 'ACTIVE';
    expect(getNextCancelStatus(getNextCancelStatus(original))).toBe(original);
  });
});

describe('isCancelledStatus', () => {
  it('returns true for CANCELLED bookings', () => {
    expect(isCancelledStatus('CANCELLED')).toBe(true);
  });

  it('returns false for ACTIVE bookings', () => {
    expect(isCancelledStatus('ACTIVE')).toBe(false);
  });
});

describe('cancel toast message selection', () => {
  function cancelToastMessage(nextStatus: BookingStatus): string {
    return nextStatus === 'CANCELLED' ? 'Booking cancelled' : 'Booking reactivated';
  }

  it('shows "Booking cancelled" when marking as cancelled', () => {
    expect(cancelToastMessage('CANCELLED')).toBe('Booking cancelled');
  });

  it('shows "Booking reactivated" when reactivating', () => {
    expect(cancelToastMessage('ACTIVE')).toBe('Booking reactivated');
  });
});
