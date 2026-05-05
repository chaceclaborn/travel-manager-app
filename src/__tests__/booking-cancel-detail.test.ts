import { describe, it, expect } from 'vitest';

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

function getCancelButtonLabel(status: BookingStatus, pending: boolean): string {
  if (pending) return '...';
  return status === 'CANCELLED' ? 'Reactivate' : 'Cancel';
}

function getProviderClasses(status: BookingStatus): string {
  return status === 'CANCELLED'
    ? 'text-slate-500 line-through'
    : 'text-slate-800';
}

function getButtonClasses(status: BookingStatus): string {
  return status === 'CANCELLED'
    ? 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50'
    : 'text-amber-600 hover:text-amber-700 hover:bg-amber-50';
}

describe('cancel toggle — next status', () => {
  it('returns CANCELLED when current is ACTIVE', () => {
    expect(getNextStatus('ACTIVE')).toBe('CANCELLED');
  });

  it('returns ACTIVE when current is CANCELLED', () => {
    expect(getNextStatus('CANCELLED')).toBe('ACTIVE');
  });
});

describe('cancel toggle — toast messages', () => {
  it('shows "Booking cancelled" when cancelling', () => {
    expect(getCancelToastMessage('CANCELLED')).toBe('Booking cancelled');
  });

  it('shows "Booking reactivated" when reactivating', () => {
    expect(getCancelToastMessage('ACTIVE')).toBe('Booking reactivated');
  });
});

describe('cancel toggle — error messages', () => {
  it('shows failure message when cancel fails', () => {
    expect(getCancelErrorMessage('CANCELLED')).toBe('Failed to cancel booking');
  });

  it('shows failure message when reactivate fails', () => {
    expect(getCancelErrorMessage('ACTIVE')).toBe('Failed to reactivate booking');
  });
});

describe('cancel button label', () => {
  it('shows "Cancel" when booking is active', () => {
    expect(getCancelButtonLabel('ACTIVE', false)).toBe('Cancel');
  });

  it('shows "Reactivate" when booking is cancelled', () => {
    expect(getCancelButtonLabel('CANCELLED', false)).toBe('Reactivate');
  });

  it('shows "..." while request is pending', () => {
    expect(getCancelButtonLabel('ACTIVE', true)).toBe('...');
    expect(getCancelButtonLabel('CANCELLED', true)).toBe('...');
  });
});

describe('provider name CSS classes', () => {
  it('applies strikethrough and muted colour when cancelled', () => {
    const classes = getProviderClasses('CANCELLED');
    expect(classes).toContain('line-through');
    expect(classes).toContain('text-slate-500');
  });

  it('applies normal style when active', () => {
    const classes = getProviderClasses('ACTIVE');
    expect(classes).not.toContain('line-through');
    expect(classes).toContain('text-slate-800');
  });
});

describe('cancel button CSS classes', () => {
  it('uses amber for the cancel action', () => {
    expect(getButtonClasses('ACTIVE')).toContain('text-amber-600');
  });

  it('uses emerald for the reactivate action', () => {
    expect(getButtonClasses('CANCELLED')).toContain('text-emerald-600');
  });
});
