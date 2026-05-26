import { describe, it, expect } from 'vitest';

type BookingStatus = 'ACTIVE' | 'CANCELLED';

function getNextStatus(current: BookingStatus): BookingStatus {
  return current === 'CANCELLED' ? 'ACTIVE' : 'CANCELLED';
}

function getCancelToast(nextStatus: BookingStatus): string {
  return nextStatus === 'CANCELLED' ? 'Booking cancelled' : 'Booking reactivated';
}

function getCancelErrorToast(nextStatus: BookingStatus): string {
  return nextStatus === 'CANCELLED' ? 'Failed to cancel booking' : 'Failed to reactivate booking';
}

function getCancelButtonLabel(status: BookingStatus): string {
  return status === 'CANCELLED' ? 'Reactivate' : 'Cancel';
}

function getCancelAriaLabel(status: BookingStatus): string {
  return status === 'CANCELLED' ? 'Reactivate booking' : 'Mark as cancelled';
}

function getProviderClass(status: BookingStatus): string {
  return status === 'CANCELLED' ? 'text-slate-500 line-through' : 'text-slate-800';
}

function isCancelledBadgeVisible(status: BookingStatus): boolean {
  return status === 'CANCELLED';
}

describe('booking cancel toggle logic', () => {
  it('returns CANCELLED when current status is ACTIVE', () => {
    expect(getNextStatus('ACTIVE')).toBe('CANCELLED');
  });

  it('returns ACTIVE when current status is CANCELLED', () => {
    expect(getNextStatus('CANCELLED')).toBe('ACTIVE');
  });

  it('shows correct toast when cancelling', () => {
    expect(getCancelToast('CANCELLED')).toBe('Booking cancelled');
  });

  it('shows correct toast when reactivating', () => {
    expect(getCancelToast('ACTIVE')).toBe('Booking reactivated');
  });

  it('shows correct error toast when cancel fails', () => {
    expect(getCancelErrorToast('CANCELLED')).toBe('Failed to cancel booking');
  });

  it('shows correct error toast when reactivation fails', () => {
    expect(getCancelErrorToast('ACTIVE')).toBe('Failed to reactivate booking');
  });

  it('button label is Cancel for ACTIVE booking', () => {
    expect(getCancelButtonLabel('ACTIVE')).toBe('Cancel');
  });

  it('button label is Reactivate for CANCELLED booking', () => {
    expect(getCancelButtonLabel('CANCELLED')).toBe('Reactivate');
  });

  it('aria-label reflects cancel for ACTIVE booking', () => {
    expect(getCancelAriaLabel('ACTIVE')).toBe('Mark as cancelled');
  });

  it('aria-label reflects reactivate for CANCELLED booking', () => {
    expect(getCancelAriaLabel('CANCELLED')).toBe('Reactivate booking');
  });

  it('provider name has strikethrough when cancelled', () => {
    expect(getProviderClass('CANCELLED')).toContain('line-through');
  });

  it('provider name is normal when active', () => {
    expect(getProviderClass('ACTIVE')).not.toContain('line-through');
  });

  it('cancelled badge is visible when status is CANCELLED', () => {
    expect(isCancelledBadgeVisible('CANCELLED')).toBe(true);
  });

  it('cancelled badge is hidden when status is ACTIVE', () => {
    expect(isCancelledBadgeVisible('ACTIVE')).toBe(false);
  });
});
