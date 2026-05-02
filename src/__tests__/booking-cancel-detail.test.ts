import { describe, it, expect } from 'vitest';
import { validateEnum } from '@/lib/sanitize';

// Pure logic mirrored from the booking detail page component.
// These helpers aren't extracted to a separate file to keep the component
// minimal, so we test the same logic here as standalone functions.

type BookingStatus = 'ACTIVE' | 'CANCELLED';

const BOOKING_STATUS_VALUES = ['ACTIVE', 'CANCELLED'] as const;

function getNextStatus(current: BookingStatus): BookingStatus {
  return current === 'CANCELLED' ? 'ACTIVE' : 'CANCELLED';
}

function getCancelToastMessage(nextStatus: BookingStatus): string {
  return nextStatus === 'CANCELLED' ? 'Booking cancelled' : 'Booking reactivated';
}

function getCancelErrorMessage(nextStatus: BookingStatus): string {
  return nextStatus === 'CANCELLED' ? 'Failed to cancel booking' : 'Failed to reactivate booking';
}

function getCancelButtonLabel(isCancelled: boolean): string {
  return isCancelled ? 'Reactivate' : 'Cancel';
}

function getProviderNameClass(isCancelled: boolean): string {
  return isCancelled ? 'line-through text-slate-400' : 'text-slate-800';
}

function buildCancelPayload(nextStatus: BookingStatus): Record<string, unknown> {
  return { status: nextStatus };
}

describe('booking detail cancel — status toggle', () => {
  it('returns CANCELLED when current status is ACTIVE', () => {
    expect(getNextStatus('ACTIVE')).toBe('CANCELLED');
  });

  it('returns ACTIVE when current status is CANCELLED', () => {
    expect(getNextStatus('CANCELLED')).toBe('ACTIVE');
  });
});

describe('booking detail cancel — toast messages', () => {
  it('shows "Booking cancelled" when cancelling', () => {
    expect(getCancelToastMessage('CANCELLED')).toBe('Booking cancelled');
  });

  it('shows "Booking reactivated" when reactivating', () => {
    expect(getCancelToastMessage('ACTIVE')).toBe('Booking reactivated');
  });

  it('shows failure message for cancel', () => {
    expect(getCancelErrorMessage('CANCELLED')).toBe('Failed to cancel booking');
  });

  it('shows failure message for reactivation', () => {
    expect(getCancelErrorMessage('ACTIVE')).toBe('Failed to reactivate booking');
  });
});

describe('booking detail cancel — button label', () => {
  it('shows "Cancel" when booking is active', () => {
    expect(getCancelButtonLabel(false)).toBe('Cancel');
  });

  it('shows "Reactivate" when booking is cancelled', () => {
    expect(getCancelButtonLabel(true)).toBe('Reactivate');
  });
});

describe('booking detail cancel — provider name styling', () => {
  it('applies strikethrough and muted colour when cancelled', () => {
    expect(getProviderNameClass(true)).toContain('line-through');
    expect(getProviderNameClass(true)).toContain('text-slate-400');
  });

  it('applies normal colour when active', () => {
    expect(getProviderNameClass(false)).toBe('text-slate-800');
    expect(getProviderNameClass(false)).not.toContain('line-through');
  });
});

describe('booking detail cancel — API payload', () => {
  it('sends status: CANCELLED when cancelling', () => {
    expect(buildCancelPayload('CANCELLED')).toEqual({ status: 'CANCELLED' });
  });

  it('sends status: ACTIVE when reactivating', () => {
    expect(buildCancelPayload('ACTIVE')).toEqual({ status: 'ACTIVE' });
  });
});

describe('booking status validation via validateEnum', () => {
  it('accepts ACTIVE as a valid status', () => {
    expect(validateEnum('ACTIVE', BOOKING_STATUS_VALUES)).toBe(true);
  });

  it('accepts CANCELLED as a valid status', () => {
    expect(validateEnum('CANCELLED', BOOKING_STATUS_VALUES)).toBe(true);
  });

  it('rejects an arbitrary string as invalid', () => {
    expect(validateEnum('PENDING', BOOKING_STATUS_VALUES)).toBe(false);
  });

  it('rejects empty string as invalid', () => {
    expect(validateEnum('', BOOKING_STATUS_VALUES)).toBe(false);
  });
});
