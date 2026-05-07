import { describe, it, expect } from 'vitest';
import { validateEnum } from '@/lib/sanitize';

// Pure logic extracted from the booking detail page cancel feature.
// These mirror exactly what the component does inline.

type BookingStatus = 'ACTIVE' | 'CANCELLED';

const BOOKING_STATUS_VALUES = ['ACTIVE', 'CANCELLED'] as const;

function getNextStatus(current: BookingStatus): BookingStatus {
  return current === 'CANCELLED' ? 'ACTIVE' : 'CANCELLED';
}

function getCancelButtonLabel(isCancelled: boolean): string {
  return isCancelled ? 'Reactivate' : 'Cancel';
}

function getCancelToastMessage(nextStatus: BookingStatus): string {
  return nextStatus === 'CANCELLED' ? 'Booking cancelled' : 'Booking reactivated';
}

function getCancelErrorMessage(nextStatus: BookingStatus): string {
  return nextStatus === 'CANCELLED' ? 'Failed to cancel booking' : 'Failed to reactivate booking';
}

function getProviderClassName(isCancelled: boolean): string {
  return isCancelled ? 'text-slate-400 line-through' : 'text-slate-800';
}

function getCancelButtonClassName(isCancelled: boolean): string {
  return isCancelled
    ? 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50'
    : 'text-amber-600 hover:text-amber-700 hover:bg-amber-50';
}

describe('booking detail cancel: status toggle', () => {
  it('toggles ACTIVE to CANCELLED', () => {
    expect(getNextStatus('ACTIVE')).toBe('CANCELLED');
  });

  it('toggles CANCELLED back to ACTIVE', () => {
    expect(getNextStatus('CANCELLED')).toBe('ACTIVE');
  });
});

describe('booking detail cancel: button label', () => {
  it('shows Cancel when booking is active', () => {
    expect(getCancelButtonLabel(false)).toBe('Cancel');
  });

  it('shows Reactivate when booking is cancelled', () => {
    expect(getCancelButtonLabel(true)).toBe('Reactivate');
  });
});

describe('booking detail cancel: toast messages', () => {
  it('says "Booking cancelled" when next status is CANCELLED', () => {
    expect(getCancelToastMessage('CANCELLED')).toBe('Booking cancelled');
  });

  it('says "Booking reactivated" when next status is ACTIVE', () => {
    expect(getCancelToastMessage('ACTIVE')).toBe('Booking reactivated');
  });

  it('says "Failed to cancel booking" on error when cancelling', () => {
    expect(getCancelErrorMessage('CANCELLED')).toBe('Failed to cancel booking');
  });

  it('says "Failed to reactivate booking" on error when reactivating', () => {
    expect(getCancelErrorMessage('ACTIVE')).toBe('Failed to reactivate booking');
  });
});

describe('booking detail cancel: display styles', () => {
  it('applies strikethrough and muted colour to provider when cancelled', () => {
    const cls = getProviderClassName(true);
    expect(cls).toContain('line-through');
    expect(cls).toContain('text-slate-400');
  });

  it('applies normal colour to provider when active', () => {
    const cls = getProviderClassName(false);
    expect(cls).toContain('text-slate-800');
    expect(cls).not.toContain('line-through');
  });

  it('uses emerald colour for Reactivate button', () => {
    expect(getCancelButtonClassName(true)).toContain('text-emerald-600');
  });

  it('uses amber colour for Cancel button', () => {
    expect(getCancelButtonClassName(false)).toContain('text-amber-600');
  });
});

describe('booking detail cancel: API status validation', () => {
  it('accepts ACTIVE as a valid status', () => {
    expect(validateEnum('ACTIVE', BOOKING_STATUS_VALUES)).toBe(true);
  });

  it('accepts CANCELLED as a valid status', () => {
    expect(validateEnum('CANCELLED', BOOKING_STATUS_VALUES)).toBe(true);
  });

  it('rejects unknown status values', () => {
    expect(validateEnum('DELETED', BOOKING_STATUS_VALUES)).toBe(false);
    expect(validateEnum('', BOOKING_STATUS_VALUES)).toBe(false);
    expect(validateEnum('active', BOOKING_STATUS_VALUES)).toBe(false);
  });
});
