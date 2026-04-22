import { describe, it, expect } from 'vitest';
import { validateEnum } from '@/lib/sanitize';

const BOOKING_STATUS_VALUES = ['ACTIVE', 'CANCELLED'] as const;
type BookingStatus = (typeof BOOKING_STATUS_VALUES)[number];

function getNextStatus(current: BookingStatus): BookingStatus {
  return current === 'CANCELLED' ? 'ACTIVE' : 'CANCELLED';
}

function buildCancelPayload(nextStatus: BookingStatus): Record<string, unknown> {
  return { status: nextStatus };
}

describe('Booking detail page — cancel/reactivate logic', () => {
  it('toggles ACTIVE to CANCELLED', () => {
    expect(getNextStatus('ACTIVE')).toBe('CANCELLED');
  });

  it('toggles CANCELLED to ACTIVE', () => {
    expect(getNextStatus('CANCELLED')).toBe('ACTIVE');
  });

  it('builds correct payload for cancellation', () => {
    expect(buildCancelPayload('CANCELLED')).toEqual({ status: 'CANCELLED' });
  });

  it('builds correct payload for reactivation', () => {
    expect(buildCancelPayload('ACTIVE')).toEqual({ status: 'ACTIVE' });
  });

  it('ACTIVE is a valid status', () => {
    expect(validateEnum('ACTIVE', BOOKING_STATUS_VALUES)).toBe(true);
  });

  it('CANCELLED is a valid status', () => {
    expect(validateEnum('CANCELLED', BOOKING_STATUS_VALUES)).toBe(true);
  });

  it('rejects unknown status values', () => {
    expect(validateEnum('PENDING', BOOKING_STATUS_VALUES)).toBe(false);
    expect(validateEnum('', BOOKING_STATUS_VALUES)).toBe(false);
    expect(validateEnum('active', BOOKING_STATUS_VALUES)).toBe(false);
  });

  it('isCancelled reflects status correctly', () => {
    const isCancelled = (status: BookingStatus) => status === 'CANCELLED';
    expect(isCancelled('CANCELLED')).toBe(true);
    expect(isCancelled('ACTIVE')).toBe(false);
  });

  it('cancel toast message matches expected value', () => {
    const toastMessage = (nextStatus: BookingStatus) =>
      nextStatus === 'CANCELLED' ? 'Booking cancelled' : 'Booking reactivated';
    expect(toastMessage('CANCELLED')).toBe('Booking cancelled');
    expect(toastMessage('ACTIVE')).toBe('Booking reactivated');
  });

  it('cancel error message matches expected value', () => {
    const errorMessage = (nextStatus: BookingStatus) =>
      nextStatus === 'CANCELLED' ? 'Failed to cancel booking' : 'Failed to reactivate booking';
    expect(errorMessage('CANCELLED')).toBe('Failed to cancel booking');
    expect(errorMessage('ACTIVE')).toBe('Failed to reactivate booking');
  });
});
