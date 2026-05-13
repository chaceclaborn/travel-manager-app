import { describe, it, expect } from 'vitest';

type BookingStatus = 'ACTIVE' | 'CANCELLED';

function getNextStatus(current: BookingStatus): BookingStatus {
  return current === 'CANCELLED' ? 'ACTIVE' : 'CANCELLED';
}

function getCancelButtonLabel(status: BookingStatus): string {
  return status === 'CANCELLED' ? 'Reactivate' : 'Cancel';
}

function getToastMessage(nextStatus: BookingStatus): string {
  return nextStatus === 'CANCELLED' ? 'Booking cancelled' : 'Booking reactivated';
}

function getErrorMessage(nextStatus: BookingStatus): string {
  return nextStatus === 'CANCELLED' ? 'Failed to cancel booking' : 'Failed to reactivate booking';
}

function getProviderClassName(status: BookingStatus): string {
  return status === 'CANCELLED' ? 'text-slate-400 line-through' : 'text-slate-800';
}

function getButtonClassName(status: BookingStatus): string {
  return status === 'CANCELLED'
    ? 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50'
    : 'text-amber-600 hover:text-amber-700 hover:bg-amber-50';
}

describe('booking detail cancel toggle — status transitions', () => {
  it('toggles ACTIVE → CANCELLED', () => {
    expect(getNextStatus('ACTIVE')).toBe('CANCELLED');
  });

  it('toggles CANCELLED → ACTIVE', () => {
    expect(getNextStatus('CANCELLED')).toBe('ACTIVE');
  });
});

describe('booking detail cancel toggle — button labels', () => {
  it('shows Cancel when booking is ACTIVE', () => {
    expect(getCancelButtonLabel('ACTIVE')).toBe('Cancel');
  });

  it('shows Reactivate when booking is CANCELLED', () => {
    expect(getCancelButtonLabel('CANCELLED')).toBe('Reactivate');
  });
});

describe('booking detail cancel toggle — toast messages', () => {
  it('shows cancellation toast when moving to CANCELLED', () => {
    expect(getToastMessage('CANCELLED')).toBe('Booking cancelled');
  });

  it('shows reactivation toast when moving to ACTIVE', () => {
    expect(getToastMessage('ACTIVE')).toBe('Booking reactivated');
  });
});

describe('booking detail cancel toggle — error messages', () => {
  it('shows cancel error when cancellation fails', () => {
    expect(getErrorMessage('CANCELLED')).toBe('Failed to cancel booking');
  });

  it('shows reactivate error when reactivation fails', () => {
    expect(getErrorMessage('ACTIVE')).toBe('Failed to reactivate booking');
  });
});

describe('booking detail cancel toggle — provider name styling', () => {
  it('strikes through and greys provider name when cancelled', () => {
    const cls = getProviderClassName('CANCELLED');
    expect(cls).toContain('line-through');
    expect(cls).toContain('text-slate-400');
  });

  it('shows normal provider name when active', () => {
    const cls = getProviderClassName('ACTIVE');
    expect(cls).not.toContain('line-through');
    expect(cls).toContain('text-slate-800');
  });
});

describe('booking detail cancel toggle — button colour classes', () => {
  it('uses amber colour for Cancel (active booking)', () => {
    const cls = getButtonClassName('ACTIVE');
    expect(cls).toContain('text-amber-600');
  });

  it('uses emerald colour for Reactivate (cancelled booking)', () => {
    const cls = getButtonClassName('CANCELLED');
    expect(cls).toContain('text-emerald-600');
  });
});
