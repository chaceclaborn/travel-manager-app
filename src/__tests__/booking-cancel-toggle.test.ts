import { describe, it, expect } from 'vitest';
import { validateEnum } from '@/lib/sanitize';

type BookingStatus = 'ACTIVE' | 'CANCELLED';

const BOOKING_STATUS_VALUES = ['ACTIVE', 'CANCELLED'] as const;

function toggleStatus(current: BookingStatus): BookingStatus {
  return current === 'CANCELLED' ? 'ACTIVE' : 'CANCELLED';
}

function cancelToast(next: BookingStatus): string {
  return next === 'CANCELLED' ? 'Booking cancelled' : 'Booking reactivated';
}

function cancelErrorToast(next: BookingStatus): string {
  return next === 'CANCELLED' ? 'Failed to cancel booking' : 'Failed to reactivate booking';
}

describe('booking cancel toggle', () => {
  it('toggles ACTIVE → CANCELLED', () => {
    expect(toggleStatus('ACTIVE')).toBe('CANCELLED');
  });

  it('toggles CANCELLED → ACTIVE', () => {
    expect(toggleStatus('CANCELLED')).toBe('ACTIVE');
  });

  it('toggle is its own inverse for ACTIVE', () => {
    expect(toggleStatus(toggleStatus('ACTIVE'))).toBe('ACTIVE');
  });

  it('toggle is its own inverse for CANCELLED', () => {
    expect(toggleStatus(toggleStatus('CANCELLED'))).toBe('CANCELLED');
  });

  it('shows "Booking cancelled" toast when cancelling', () => {
    expect(cancelToast('CANCELLED')).toBe('Booking cancelled');
  });

  it('shows "Booking reactivated" toast when reactivating', () => {
    expect(cancelToast('ACTIVE')).toBe('Booking reactivated');
  });

  it('shows correct error toast when cancel fails', () => {
    expect(cancelErrorToast('CANCELLED')).toBe('Failed to cancel booking');
  });

  it('shows correct error toast when reactivate fails', () => {
    expect(cancelErrorToast('ACTIVE')).toBe('Failed to reactivate booking');
  });

  it('ACTIVE is a valid booking status', () => {
    expect(validateEnum('ACTIVE', BOOKING_STATUS_VALUES)).toBe(true);
  });

  it('CANCELLED is a valid booking status', () => {
    expect(validateEnum('CANCELLED', BOOKING_STATUS_VALUES)).toBe(true);
  });

  it('rejects invalid status values', () => {
    expect(validateEnum('DELETED', BOOKING_STATUS_VALUES)).toBe(false);
    expect(validateEnum('', BOOKING_STATUS_VALUES)).toBe(false);
    expect(validateEnum('active', BOOKING_STATUS_VALUES)).toBe(false);
  });
});
