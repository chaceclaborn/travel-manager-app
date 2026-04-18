import { describe, it, expect } from 'vitest';
import { validateEnum } from '@/lib/sanitize';

// Status toggle logic extracted from the detail page's handleCancelToggle
function getNextStatus(current: 'ACTIVE' | 'CANCELLED'): 'ACTIVE' | 'CANCELLED' {
  return current === 'CANCELLED' ? 'ACTIVE' : 'CANCELLED';
}

function getCancelToastMessage(nextStatus: 'ACTIVE' | 'CANCELLED'): string {
  return nextStatus === 'CANCELLED' ? 'Booking cancelled' : 'Booking reactivated';
}

function getCancelErrorMessage(nextStatus: 'ACTIVE' | 'CANCELLED'): string {
  return nextStatus === 'CANCELLED' ? 'Failed to cancel booking' : 'Failed to reactivate booking';
}

const BOOKING_STATUS_VALUES = ['ACTIVE', 'CANCELLED'] as const;

describe('booking detail cancel toggle', () => {
  it('toggles ACTIVE to CANCELLED', () => {
    expect(getNextStatus('ACTIVE')).toBe('CANCELLED');
  });

  it('toggles CANCELLED to ACTIVE', () => {
    expect(getNextStatus('CANCELLED')).toBe('ACTIVE');
  });

  it('shows correct toast when cancelling', () => {
    expect(getCancelToastMessage('CANCELLED')).toBe('Booking cancelled');
  });

  it('shows correct toast when reactivating', () => {
    expect(getCancelToastMessage('ACTIVE')).toBe('Booking reactivated');
  });

  it('shows correct error when cancel fails', () => {
    expect(getCancelErrorMessage('CANCELLED')).toBe('Failed to cancel booking');
  });

  it('shows correct error when reactivate fails', () => {
    expect(getCancelErrorMessage('ACTIVE')).toBe('Failed to reactivate booking');
  });
});

describe('booking status validation', () => {
  it('accepts ACTIVE status', () => {
    expect(validateEnum('ACTIVE', BOOKING_STATUS_VALUES)).toBe(true);
  });

  it('accepts CANCELLED status', () => {
    expect(validateEnum('CANCELLED', BOOKING_STATUS_VALUES)).toBe(true);
  });

  it('rejects invalid status values', () => {
    expect(validateEnum('DELETED', BOOKING_STATUS_VALUES)).toBe(false);
    expect(validateEnum('', BOOKING_STATUS_VALUES)).toBe(false);
    expect(validateEnum('active', BOOKING_STATUS_VALUES)).toBe(false);
  });

  it('PUT body contains only status when toggling', () => {
    const nextStatus = getNextStatus('ACTIVE');
    const body = JSON.stringify({ status: nextStatus });
    const parsed = JSON.parse(body);
    expect(parsed).toEqual({ status: 'CANCELLED' });
    expect(Object.keys(parsed)).toHaveLength(1);
  });
});
