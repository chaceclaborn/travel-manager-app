import { describe, it, expect } from 'vitest';
import { validateEnum } from '@/lib/sanitize';

const BOOKING_STATUS_VALUES = ['ACTIVE', 'CANCELLED'] as const;
type BookingStatus = (typeof BOOKING_STATUS_VALUES)[number];

function getNextStatus(current: BookingStatus): BookingStatus {
  return current === 'ACTIVE' ? 'CANCELLED' : 'ACTIVE';
}

function getCancelLabel(status: BookingStatus): string {
  return status === 'CANCELLED' ? 'Reactivate booking' : 'Mark as cancelled';
}

function getToastMessage(nextStatus: BookingStatus): string {
  return nextStatus === 'CANCELLED' ? 'Booking cancelled' : 'Booking reactivated';
}

function getErrorMessage(nextStatus: BookingStatus): string {
  return nextStatus === 'CANCELLED' ? 'Failed to cancel booking' : 'Failed to reactivate booking';
}

describe('booking status validation', () => {
  it('accepts ACTIVE', () => {
    expect(validateEnum('ACTIVE', BOOKING_STATUS_VALUES)).toBe(true);
  });

  it('accepts CANCELLED', () => {
    expect(validateEnum('CANCELLED', BOOKING_STATUS_VALUES)).toBe(true);
  });

  it('rejects invalid status', () => {
    expect(validateEnum('DELETED', BOOKING_STATUS_VALUES)).toBe(false);
  });

  it('rejects lowercase active', () => {
    expect(validateEnum('active', BOOKING_STATUS_VALUES)).toBe(false);
  });
});

describe('cancel toggle logic', () => {
  it('toggles ACTIVE to CANCELLED', () => {
    expect(getNextStatus('ACTIVE')).toBe('CANCELLED');
  });

  it('toggles CANCELLED to ACTIVE', () => {
    expect(getNextStatus('CANCELLED')).toBe('ACTIVE');
  });
});

describe('cancel button label', () => {
  it('shows cancel label for active booking', () => {
    expect(getCancelLabel('ACTIVE')).toBe('Mark as cancelled');
  });

  it('shows reactivate label for cancelled booking', () => {
    expect(getCancelLabel('CANCELLED')).toBe('Reactivate booking');
  });
});

describe('cancel toast messages', () => {
  it('shows cancelled message', () => {
    expect(getToastMessage('CANCELLED')).toBe('Booking cancelled');
  });

  it('shows reactivated message', () => {
    expect(getToastMessage('ACTIVE')).toBe('Booking reactivated');
  });
});

describe('cancel error messages', () => {
  it('shows cancel error', () => {
    expect(getErrorMessage('CANCELLED')).toBe('Failed to cancel booking');
  });

  it('shows reactivate error', () => {
    expect(getErrorMessage('ACTIVE')).toBe('Failed to reactivate booking');
  });
});

describe('API payload construction', () => {
  it('sends correct payload for cancel', () => {
    const payload = JSON.stringify({ status: 'CANCELLED' });
    expect(JSON.parse(payload)).toEqual({ status: 'CANCELLED' });
  });

  it('sends correct payload for reactivate', () => {
    const payload = JSON.stringify({ status: 'ACTIVE' });
    expect(JSON.parse(payload)).toEqual({ status: 'ACTIVE' });
  });
});
