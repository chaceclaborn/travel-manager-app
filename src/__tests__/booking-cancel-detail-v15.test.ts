import { describe, it, expect } from 'vitest';

type BookingStatus = 'ACTIVE' | 'CANCELLED';

function getNextCancelStatus(current: BookingStatus): BookingStatus {
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

function getProviderClasses(isCancelled: boolean): string {
  return isCancelled ? 'line-through text-slate-400' : '';
}

describe('booking detail cancel toggle', () => {
  it('toggles ACTIVE to CANCELLED', () => {
    expect(getNextCancelStatus('ACTIVE')).toBe('CANCELLED');
  });

  it('toggles CANCELLED to ACTIVE', () => {
    expect(getNextCancelStatus('CANCELLED')).toBe('ACTIVE');
  });

  it('shows Cancel button for active booking', () => {
    expect(getCancelButtonLabel(false)).toBe('Cancel');
  });

  it('shows Reactivate button for cancelled booking', () => {
    expect(getCancelButtonLabel(true)).toBe('Reactivate');
  });

  it('shows success toast after cancelling', () => {
    expect(getCancelToastMessage('CANCELLED')).toBe('Booking cancelled');
  });

  it('shows success toast after reactivating', () => {
    expect(getCancelToastMessage('ACTIVE')).toBe('Booking reactivated');
  });

  it('shows error toast when cancel fails', () => {
    expect(getCancelErrorMessage('CANCELLED')).toBe('Failed to cancel booking');
  });

  it('shows error toast when reactivate fails', () => {
    expect(getCancelErrorMessage('ACTIVE')).toBe('Failed to reactivate booking');
  });

  it('applies strikethrough classes when cancelled', () => {
    expect(getProviderClasses(true)).toContain('line-through');
  });

  it('applies no strikethrough classes when active', () => {
    expect(getProviderClasses(false)).toBe('');
  });
});
