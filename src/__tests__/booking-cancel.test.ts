import { describe, it, expect } from 'vitest';
import { validateEnum } from '@/lib/sanitize';

type BookingStatus = 'ACTIVE' | 'CANCELLED';

const BOOKING_STATUSES = ['ACTIVE', 'CANCELLED'] as const;

function nextCancelStatus(current: BookingStatus): BookingStatus {
  return current === 'CANCELLED' ? 'ACTIVE' : 'CANCELLED';
}

function cancelToastMessage(next: BookingStatus): string {
  return next === 'CANCELLED' ? 'Booking cancelled' : 'Booking reactivated';
}

function cancelErrorMessage(next: BookingStatus): string {
  return next === 'CANCELLED' ? 'Failed to cancel booking' : 'Failed to reactivate booking';
}

describe('booking cancel toggle', () => {
  it('toggles ACTIVE → CANCELLED', () => {
    expect(nextCancelStatus('ACTIVE')).toBe('CANCELLED');
  });

  it('toggles CANCELLED → ACTIVE', () => {
    expect(nextCancelStatus('CANCELLED')).toBe('ACTIVE');
  });

  it('toggle is its own inverse for ACTIVE', () => {
    expect(nextCancelStatus(nextCancelStatus('ACTIVE'))).toBe('ACTIVE');
  });

  it('toggle is its own inverse for CANCELLED', () => {
    expect(nextCancelStatus(nextCancelStatus('CANCELLED'))).toBe('CANCELLED');
  });

  it('success toast says "Booking cancelled" when cancelling', () => {
    expect(cancelToastMessage('CANCELLED')).toBe('Booking cancelled');
  });

  it('success toast says "Booking reactivated" when reactivating', () => {
    expect(cancelToastMessage('ACTIVE')).toBe('Booking reactivated');
  });

  it('error toast says "Failed to cancel booking" when cancelling', () => {
    expect(cancelErrorMessage('CANCELLED')).toBe('Failed to cancel booking');
  });

  it('error toast says "Failed to reactivate booking" when reactivating', () => {
    expect(cancelErrorMessage('ACTIVE')).toBe('Failed to reactivate booking');
  });

  it('ACTIVE is a valid BookingStatus', () => {
    expect(validateEnum('ACTIVE', BOOKING_STATUSES)).toBe(true);
  });

  it('CANCELLED is a valid BookingStatus', () => {
    expect(validateEnum('CANCELLED', BOOKING_STATUSES)).toBe(true);
  });

  it('rejects unknown status values', () => {
    expect(validateEnum('DELETED', BOOKING_STATUSES)).toBe(false);
    expect(validateEnum('', BOOKING_STATUSES)).toBe(false);
    expect(validateEnum('active', BOOKING_STATUSES)).toBe(false);
  });
});
