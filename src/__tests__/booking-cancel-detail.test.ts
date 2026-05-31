import { describe, it, expect } from 'vitest';
import { validateEnum } from '@/lib/sanitize';

const BOOKING_STATUS_VALUES = ['ACTIVE', 'CANCELLED'] as const;
type BookingStatus = (typeof BOOKING_STATUS_VALUES)[number];

function getNextStatus(current: BookingStatus): BookingStatus {
  return current === 'CANCELLED' ? 'ACTIVE' : 'CANCELLED';
}

function getCancelButtonLabel(isCancelled: boolean, cancelling: boolean): string {
  if (cancelling) return '';
  return isCancelled ? 'Reactivate' : 'Cancel';
}

function getToastMessage(nextStatus: BookingStatus, isError = false): string {
  if (nextStatus === 'CANCELLED') {
    return isError ? 'Failed to cancel booking' : 'Booking cancelled';
  }
  return isError ? 'Failed to reactivate booking' : 'Booking reactivated';
}

function getProviderClasses(isCancelled: boolean): string {
  return isCancelled ? 'text-slate-400 line-through' : 'text-slate-800';
}

function getCancelButtonClasses(isCancelled: boolean): string {
  return isCancelled
    ? 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50'
    : 'text-amber-600 hover:text-amber-700 hover:bg-amber-50';
}

describe('booking detail page — cancel/reactivate toggle logic', () => {
  it('toggles ACTIVE to CANCELLED', () => {
    expect(getNextStatus('ACTIVE')).toBe('CANCELLED');
  });

  it('toggles CANCELLED back to ACTIVE', () => {
    expect(getNextStatus('CANCELLED')).toBe('ACTIVE');
  });

  it('shows "Cancel" button label for active bookings', () => {
    expect(getCancelButtonLabel(false, false)).toBe('Cancel');
  });

  it('shows "Reactivate" button label for cancelled bookings', () => {
    expect(getCancelButtonLabel(true, false)).toBe('Reactivate');
  });

  it('shows empty label while request is in-flight', () => {
    expect(getCancelButtonLabel(false, true)).toBe('');
    expect(getCancelButtonLabel(true, true)).toBe('');
  });

  it('shows success toast when cancelling', () => {
    expect(getToastMessage('CANCELLED')).toBe('Booking cancelled');
  });

  it('shows success toast when reactivating', () => {
    expect(getToastMessage('ACTIVE')).toBe('Booking reactivated');
  });

  it('shows error toast when cancel fails', () => {
    expect(getToastMessage('CANCELLED', true)).toBe('Failed to cancel booking');
  });

  it('shows error toast when reactivate fails', () => {
    expect(getToastMessage('ACTIVE', true)).toBe('Failed to reactivate booking');
  });

  it('applies strikethrough and muted colour for cancelled provider name', () => {
    expect(getProviderClasses(true)).toContain('line-through');
    expect(getProviderClasses(true)).toContain('text-slate-400');
  });

  it('applies bold dark colour for active provider name', () => {
    const classes = getProviderClasses(false);
    expect(classes).not.toContain('line-through');
    expect(classes).toContain('text-slate-800');
  });

  it('applies amber colour for Cancel button on active booking', () => {
    expect(getCancelButtonClasses(false)).toContain('text-amber-600');
  });

  it('applies emerald colour for Reactivate button on cancelled booking', () => {
    expect(getCancelButtonClasses(true)).toContain('text-emerald-600');
  });
});

describe('booking status validation', () => {
  it('accepts ACTIVE as valid status', () => {
    expect(validateEnum('ACTIVE', BOOKING_STATUS_VALUES)).toBe(true);
  });

  it('accepts CANCELLED as valid status', () => {
    expect(validateEnum('CANCELLED', BOOKING_STATUS_VALUES)).toBe(true);
  });

  it('rejects unknown status values', () => {
    expect(validateEnum('PENDING', BOOKING_STATUS_VALUES)).toBe(false);
    expect(validateEnum('DELETED', BOOKING_STATUS_VALUES)).toBe(false);
    expect(validateEnum('', BOOKING_STATUS_VALUES)).toBe(false);
  });

  it('builds correct API payload for cancel', () => {
    const payload = JSON.stringify({ status: getNextStatus('ACTIVE') });
    expect(JSON.parse(payload)).toEqual({ status: 'CANCELLED' });
  });

  it('builds correct API payload for reactivate', () => {
    const payload = JSON.stringify({ status: getNextStatus('CANCELLED') });
    expect(JSON.parse(payload)).toEqual({ status: 'ACTIVE' });
  });
});
