import { describe, it, expect } from 'vitest';
import { validateEnum } from '@/lib/sanitize';

const BOOKING_STATUS_VALUES = ['ACTIVE', 'CANCELLED'] as const;
type BookingStatus = (typeof BOOKING_STATUS_VALUES)[number];

// Pure toggle logic mirroring the detail page's handleCancel
function nextStatus(current: BookingStatus): BookingStatus {
  return current === 'CANCELLED' ? 'ACTIVE' : 'CANCELLED';
}

function cancelToastMessage(next: BookingStatus): string {
  return next === 'CANCELLED' ? 'Booking cancelled' : 'Booking reactivated';
}

function cancelErrorMessage(next: BookingStatus): string {
  return next === 'CANCELLED' ? 'Failed to cancel booking' : 'Failed to reactivate booking';
}

describe('booking status toggle logic', () => {
  it('toggles ACTIVE to CANCELLED', () => {
    expect(nextStatus('ACTIVE')).toBe('CANCELLED');
  });

  it('toggles CANCELLED to ACTIVE', () => {
    expect(nextStatus('CANCELLED')).toBe('ACTIVE');
  });

  it('is its own inverse (double toggle returns original)', () => {
    expect(nextStatus(nextStatus('ACTIVE'))).toBe('ACTIVE');
    expect(nextStatus(nextStatus('CANCELLED'))).toBe('CANCELLED');
  });
});

describe('cancel/reactivate toast messages', () => {
  it('shows "Booking cancelled" when toggling to CANCELLED', () => {
    expect(cancelToastMessage('CANCELLED')).toBe('Booking cancelled');
  });

  it('shows "Booking reactivated" when toggling to ACTIVE', () => {
    expect(cancelToastMessage('ACTIVE')).toBe('Booking reactivated');
  });

  it('shows correct error for cancelling', () => {
    expect(cancelErrorMessage('CANCELLED')).toBe('Failed to cancel booking');
  });

  it('shows correct error for reactivating', () => {
    expect(cancelErrorMessage('ACTIVE')).toBe('Failed to reactivate booking');
  });
});

describe('booking status API validation', () => {
  it('accepts ACTIVE as a valid status', () => {
    expect(validateEnum('ACTIVE', BOOKING_STATUS_VALUES)).toBe(true);
  });

  it('accepts CANCELLED as a valid status', () => {
    expect(validateEnum('CANCELLED', BOOKING_STATUS_VALUES)).toBe(true);
  });

  it('rejects unknown status strings', () => {
    expect(validateEnum('DELETED', BOOKING_STATUS_VALUES)).toBe(false);
    expect(validateEnum('active', BOOKING_STATUS_VALUES)).toBe(false);
    expect(validateEnum('', BOOKING_STATUS_VALUES)).toBe(false);
  });

  it('rejects status values injected via mixed case', () => {
    expect(validateEnum('Active', BOOKING_STATUS_VALUES)).toBe(false);
    expect(validateEnum('Cancelled', BOOKING_STATUS_VALUES)).toBe(false);
  });
});

describe('cancel request payload', () => {
  it('sends CANCELLED when cancelling an active booking', () => {
    const currentStatus: BookingStatus = 'ACTIVE';
    const payload = { status: nextStatus(currentStatus) };
    expect(payload).toEqual({ status: 'CANCELLED' });
  });

  it('sends ACTIVE when reactivating a cancelled booking', () => {
    const currentStatus: BookingStatus = 'CANCELLED';
    const payload = { status: nextStatus(currentStatus) };
    expect(payload).toEqual({ status: 'ACTIVE' });
  });
});
