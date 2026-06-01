import { describe, it, expect } from 'vitest';
import { validateEnum } from '@/lib/sanitize';

const BOOKING_STATUS_VALUES = ['ACTIVE', 'CANCELLED'] as const;
type BookingStatus = typeof BOOKING_STATUS_VALUES[number];

function getNextStatus(current: BookingStatus): BookingStatus {
  return current === 'CANCELLED' ? 'ACTIVE' : 'CANCELLED';
}

function getCancelToastMessage(nextStatus: BookingStatus): string {
  return nextStatus === 'CANCELLED' ? 'Booking cancelled' : 'Booking reactivated';
}

function getCancelErrorMessage(nextStatus: BookingStatus): string {
  return nextStatus === 'CANCELLED' ? 'Failed to cancel booking' : 'Failed to reactivate booking';
}

function getCancelButtonLabel(currentStatus: BookingStatus): string {
  return currentStatus === 'CANCELLED' ? 'Reactivate' : 'Cancel';
}

describe('booking cancel toggle logic', () => {
  it('toggles ACTIVE to CANCELLED', () => {
    expect(getNextStatus('ACTIVE')).toBe('CANCELLED');
  });

  it('toggles CANCELLED to ACTIVE', () => {
    expect(getNextStatus('CANCELLED')).toBe('ACTIVE');
  });

  it('shows "Booking cancelled" toast when cancelling', () => {
    expect(getCancelToastMessage('CANCELLED')).toBe('Booking cancelled');
  });

  it('shows "Booking reactivated" toast when reactivating', () => {
    expect(getCancelToastMessage('ACTIVE')).toBe('Booking reactivated');
  });

  it('shows cancel error message when cancelling fails', () => {
    expect(getCancelErrorMessage('CANCELLED')).toBe('Failed to cancel booking');
  });

  it('shows reactivate error message when reactivating fails', () => {
    expect(getCancelErrorMessage('ACTIVE')).toBe('Failed to reactivate booking');
  });

  it('shows "Cancel" button label for active booking', () => {
    expect(getCancelButtonLabel('ACTIVE')).toBe('Cancel');
  });

  it('shows "Reactivate" button label for cancelled booking', () => {
    expect(getCancelButtonLabel('CANCELLED')).toBe('Reactivate');
  });
});

describe('booking status validation', () => {
  it('accepts ACTIVE as a valid status', () => {
    expect(validateEnum('ACTIVE', BOOKING_STATUS_VALUES)).toBe(true);
  });

  it('accepts CANCELLED as a valid status', () => {
    expect(validateEnum('CANCELLED', BOOKING_STATUS_VALUES)).toBe(true);
  });

  it('rejects unknown status values', () => {
    expect(validateEnum('DELETED', BOOKING_STATUS_VALUES)).toBe(false);
    expect(validateEnum('active', BOOKING_STATUS_VALUES)).toBe(false);
    expect(validateEnum('', BOOKING_STATUS_VALUES)).toBe(false);
  });
});

describe('cancel API payload', () => {
  it('constructs correct payload to cancel', () => {
    const nextStatus = getNextStatus('ACTIVE');
    const payload = JSON.stringify({ status: nextStatus });
    expect(JSON.parse(payload)).toEqual({ status: 'CANCELLED' });
  });

  it('constructs correct payload to reactivate', () => {
    const nextStatus = getNextStatus('CANCELLED');
    const payload = JSON.stringify({ status: nextStatus });
    expect(JSON.parse(payload)).toEqual({ status: 'ACTIVE' });
  });
});
