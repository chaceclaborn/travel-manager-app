import { describe, it, expect } from 'vitest';
import type { BookingStatus } from '@/lib/travelmanager/types';

function getNextBookingStatus(current: BookingStatus): BookingStatus {
  return current === 'CANCELLED' ? 'ACTIVE' : 'CANCELLED';
}

function getCancelButtonLabel(current: BookingStatus): string {
  return current === 'CANCELLED' ? 'Reactivate' : 'Cancel';
}

function getCancelToastMessage(nextStatus: BookingStatus): string {
  return nextStatus === 'CANCELLED' ? 'Booking cancelled' : 'Booking reactivated';
}

function getCancelErrorMessage(nextStatus: BookingStatus): string {
  return nextStatus === 'CANCELLED' ? 'Failed to cancel booking' : 'Failed to reactivate booking';
}

function buildCancelPayload(nextStatus: BookingStatus): { status: BookingStatus } {
  return { status: nextStatus };
}

describe('booking cancel status toggle', () => {
  it('toggles ACTIVE to CANCELLED', () => {
    expect(getNextBookingStatus('ACTIVE')).toBe('CANCELLED');
  });

  it('toggles CANCELLED to ACTIVE', () => {
    expect(getNextBookingStatus('CANCELLED')).toBe('ACTIVE');
  });

  it('round-trips ACTIVE → CANCELLED → ACTIVE', () => {
    const first = getNextBookingStatus('ACTIVE');
    expect(getNextBookingStatus(first)).toBe('ACTIVE');
  });

  it('round-trips CANCELLED → ACTIVE → CANCELLED', () => {
    const first = getNextBookingStatus('CANCELLED');
    expect(getNextBookingStatus(first)).toBe('CANCELLED');
  });
});

describe('cancel button label', () => {
  it('shows Cancel for active bookings', () => {
    expect(getCancelButtonLabel('ACTIVE')).toBe('Cancel');
  });

  it('shows Reactivate for cancelled bookings', () => {
    expect(getCancelButtonLabel('CANCELLED')).toBe('Reactivate');
  });
});

describe('cancel toast messages', () => {
  it('uses "Booking cancelled" when moving to CANCELLED', () => {
    expect(getCancelToastMessage('CANCELLED')).toBe('Booking cancelled');
  });

  it('uses "Booking reactivated" when moving to ACTIVE', () => {
    expect(getCancelToastMessage('ACTIVE')).toBe('Booking reactivated');
  });
});

describe('cancel error messages', () => {
  it('uses correct error when cancel fails', () => {
    expect(getCancelErrorMessage('CANCELLED')).toBe('Failed to cancel booking');
  });

  it('uses correct error when reactivate fails', () => {
    expect(getCancelErrorMessage('ACTIVE')).toBe('Failed to reactivate booking');
  });
});

describe('cancel API payload', () => {
  it('sends status: CANCELLED when cancelling', () => {
    const payload = buildCancelPayload('CANCELLED');
    expect(payload).toEqual({ status: 'CANCELLED' });
  });

  it('sends status: ACTIVE when reactivating', () => {
    const payload = buildCancelPayload('ACTIVE');
    expect(payload).toEqual({ status: 'ACTIVE' });
  });

  it('only includes the status field', () => {
    const payload = buildCancelPayload('CANCELLED');
    expect(Object.keys(payload)).toHaveLength(1);
  });
});
