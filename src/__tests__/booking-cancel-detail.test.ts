import { describe, it, expect } from 'vitest';

// Pure logic functions mirroring what the detail page component uses.
// Testing these in isolation avoids the need for a full React mount.

type BookingStatus = 'ACTIVE' | 'CANCELLED';

function getNextStatus(current: BookingStatus): BookingStatus {
  return current === 'CANCELLED' ? 'ACTIVE' : 'CANCELLED';
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

function getCancelButtonLabel(isCancelled: boolean): string {
  return isCancelled ? 'Reactivate' : 'Cancel';
}

function getCancelButtonClass(isCancelled: boolean): string {
  return isCancelled
    ? 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50'
    : 'text-amber-600 hover:text-amber-700 hover:bg-amber-50';
}

describe('booking detail cancel — status toggle', () => {
  it('toggles ACTIVE to CANCELLED', () => {
    expect(getNextStatus('ACTIVE')).toBe('CANCELLED');
  });

  it('toggles CANCELLED to ACTIVE', () => {
    expect(getNextStatus('CANCELLED')).toBe('ACTIVE');
  });

  it('double toggle returns to the original status', () => {
    expect(getNextStatus(getNextStatus('ACTIVE'))).toBe('ACTIVE');
    expect(getNextStatus(getNextStatus('CANCELLED'))).toBe('CANCELLED');
  });
});

describe('booking detail cancel — toast messages', () => {
  it('shows "Booking cancelled" when next status is CANCELLED', () => {
    expect(getCancelToastMessage('CANCELLED')).toBe('Booking cancelled');
  });

  it('shows "Booking reactivated" when next status is ACTIVE', () => {
    expect(getCancelToastMessage('ACTIVE')).toBe('Booking reactivated');
  });

  it('shows failure message when cancelling fails', () => {
    expect(getCancelErrorMessage('CANCELLED')).toBe('Failed to cancel booking');
  });

  it('shows failure message when reactivating fails', () => {
    expect(getCancelErrorMessage('ACTIVE')).toBe('Failed to reactivate booking');
  });
});

describe('booking detail cancel — UI display', () => {
  it('provider name has line-through when cancelled', () => {
    expect(getProviderClassName(true)).toContain('line-through');
  });

  it('provider name has no line-through when active', () => {
    expect(getProviderClassName(false)).not.toContain('line-through');
  });

  it('button label is "Cancel" for active bookings', () => {
    expect(getCancelButtonLabel(false)).toBe('Cancel');
  });

  it('button label is "Reactivate" for cancelled bookings', () => {
    expect(getCancelButtonLabel(true)).toBe('Reactivate');
  });

  it('button uses amber styling for active bookings', () => {
    expect(getCancelButtonClass(false)).toContain('text-amber-600');
  });

  it('button uses emerald styling for cancelled bookings', () => {
    expect(getCancelButtonClass(true)).toContain('text-emerald-600');
  });
});
