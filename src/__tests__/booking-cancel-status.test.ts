import { describe, it, expect } from 'vitest';
import { validateEnum } from '@/lib/sanitize';

type BookingStatus = 'ACTIVE' | 'CANCELLED';

function getNextStatus(current: BookingStatus): BookingStatus {
  return current === 'CANCELLED' ? 'ACTIVE' : 'CANCELLED';
}

function getCancelToast(nextStatus: BookingStatus): string {
  return nextStatus === 'CANCELLED' ? 'Booking cancelled' : 'Booking reactivated';
}

function getCancelErrorToast(nextStatus: BookingStatus): string {
  return nextStatus === 'CANCELLED' ? 'Failed to cancel booking' : 'Failed to reactivate booking';
}

const BOOKING_STATUS_VALUES = ['ACTIVE', 'CANCELLED'] as const;

describe('booking cancel status toggle', () => {
  it('toggles ACTIVE to CANCELLED', () => {
    expect(getNextStatus('ACTIVE')).toBe('CANCELLED');
  });

  it('toggles CANCELLED to ACTIVE', () => {
    expect(getNextStatus('CANCELLED')).toBe('ACTIVE');
  });

  it('cancel toast says "Booking cancelled" when cancelling', () => {
    expect(getCancelToast('CANCELLED')).toBe('Booking cancelled');
  });

  it('cancel toast says "Booking reactivated" when reactivating', () => {
    expect(getCancelToast('ACTIVE')).toBe('Booking reactivated');
  });

  it('error toast says "Failed to cancel booking" when cancelling', () => {
    expect(getCancelErrorToast('CANCELLED')).toBe('Failed to cancel booking');
  });

  it('error toast says "Failed to reactivate booking" when reactivating', () => {
    expect(getCancelErrorToast('ACTIVE')).toBe('Failed to reactivate booking');
  });

  it('ACTIVE is a valid booking status', () => {
    expect(validateEnum('ACTIVE', BOOKING_STATUS_VALUES)).toBe(true);
  });

  it('CANCELLED is a valid booking status', () => {
    expect(validateEnum('CANCELLED', BOOKING_STATUS_VALUES)).toBe(true);
  });

  it('rejects unknown status values', () => {
    expect(validateEnum('DELETED', BOOKING_STATUS_VALUES)).toBe(false);
    expect(validateEnum('', BOOKING_STATUS_VALUES)).toBe(false);
  });

  it('toggle is its own inverse', () => {
    expect(getNextStatus(getNextStatus('ACTIVE'))).toBe('ACTIVE');
    expect(getNextStatus(getNextStatus('CANCELLED'))).toBe('CANCELLED');
  });
});
