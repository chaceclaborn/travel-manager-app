import { describe, it, expect } from 'vitest';
import { validateEnum } from '@/lib/sanitize';

type BookingStatus = 'ACTIVE' | 'CANCELLED';

function toggleStatus(current: BookingStatus): BookingStatus {
  return current === 'CANCELLED' ? 'ACTIVE' : 'CANCELLED';
}

function buildCancelPayload(status: BookingStatus): Record<string, string> {
  return { status };
}

function isCancelled(status: BookingStatus): boolean {
  return status === 'CANCELLED';
}

function cancelToastMessage(nextStatus: BookingStatus): string {
  return nextStatus === 'CANCELLED' ? 'Booking cancelled' : 'Booking reactivated';
}

function cancelErrorMessage(nextStatus: BookingStatus): string {
  return nextStatus === 'CANCELLED' ? 'Failed to cancel booking' : 'Failed to reactivate booking';
}

const BOOKING_STATUS_VALUES = ['ACTIVE', 'CANCELLED'] as const;

describe('booking detail cancel toggle logic', () => {
  it('toggles ACTIVE to CANCELLED', () => {
    expect(toggleStatus('ACTIVE')).toBe('CANCELLED');
  });

  it('toggles CANCELLED to ACTIVE', () => {
    expect(toggleStatus('CANCELLED')).toBe('ACTIVE');
  });

  it('isCancelled returns true for CANCELLED', () => {
    expect(isCancelled('CANCELLED')).toBe(true);
  });

  it('isCancelled returns false for ACTIVE', () => {
    expect(isCancelled('ACTIVE')).toBe(false);
  });

  it('buildCancelPayload sets status field', () => {
    expect(buildCancelPayload('CANCELLED')).toEqual({ status: 'CANCELLED' });
    expect(buildCancelPayload('ACTIVE')).toEqual({ status: 'ACTIVE' });
  });

  it('cancel toast shows correct message for cancellation', () => {
    expect(cancelToastMessage('CANCELLED')).toBe('Booking cancelled');
  });

  it('cancel toast shows correct message for reactivation', () => {
    expect(cancelToastMessage('ACTIVE')).toBe('Booking reactivated');
  });

  it('error toast shows correct message for failed cancel', () => {
    expect(cancelErrorMessage('CANCELLED')).toBe('Failed to cancel booking');
  });

  it('error toast shows correct message for failed reactivation', () => {
    expect(cancelErrorMessage('ACTIVE')).toBe('Failed to reactivate booking');
  });
});

describe('booking status API validation', () => {
  it('validateEnum accepts ACTIVE', () => {
    expect(validateEnum('ACTIVE', BOOKING_STATUS_VALUES)).toBe(true);
  });

  it('validateEnum accepts CANCELLED', () => {
    expect(validateEnum('CANCELLED', BOOKING_STATUS_VALUES)).toBe(true);
  });

  it('validateEnum rejects invalid status', () => {
    expect(validateEnum('PENDING', BOOKING_STATUS_VALUES)).toBe(false);
    expect(validateEnum('', BOOKING_STATUS_VALUES)).toBe(false);
    expect(validateEnum('active', BOOKING_STATUS_VALUES)).toBe(false);
  });
});
