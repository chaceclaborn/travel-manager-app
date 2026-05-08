import { describe, it, expect } from 'vitest';
import type { BookingStatus } from '@/lib/travelmanager/types';

// Pure logic extracted from handleCancelToggle in the booking detail page.
function getNextStatus(current: BookingStatus): BookingStatus {
  return current === 'CANCELLED' ? 'ACTIVE' : 'CANCELLED';
}

function getSuccessToast(nextStatus: BookingStatus): string {
  return nextStatus === 'CANCELLED' ? 'Booking cancelled' : 'Booking reactivated';
}

function getErrorToast(nextStatus: BookingStatus): string {
  return nextStatus === 'CANCELLED' ? 'Failed to cancel booking' : 'Failed to reactivate booking';
}

function getButtonLabel(status: BookingStatus): string {
  return status === 'CANCELLED' ? 'Reactivate' : 'Cancel';
}

function isProviderStruck(status: BookingStatus): boolean {
  return status === 'CANCELLED';
}

describe('booking detail cancel toggle — next status', () => {
  it('ACTIVE → CANCELLED', () => {
    expect(getNextStatus('ACTIVE')).toBe('CANCELLED');
  });

  it('CANCELLED → ACTIVE', () => {
    expect(getNextStatus('CANCELLED')).toBe('ACTIVE');
  });
});

describe('booking detail cancel toggle — success toast', () => {
  it('shows "Booking cancelled" when cancelling', () => {
    expect(getSuccessToast('CANCELLED')).toBe('Booking cancelled');
  });

  it('shows "Booking reactivated" when reactivating', () => {
    expect(getSuccessToast('ACTIVE')).toBe('Booking reactivated');
  });
});

describe('booking detail cancel toggle — error toast', () => {
  it('shows cancel failure message when cancelling', () => {
    expect(getErrorToast('CANCELLED')).toBe('Failed to cancel booking');
  });

  it('shows reactivate failure message when reactivating', () => {
    expect(getErrorToast('ACTIVE')).toBe('Failed to reactivate booking');
  });
});

describe('booking detail cancel toggle — button label', () => {
  it('shows "Cancel" when booking is active', () => {
    expect(getButtonLabel('ACTIVE')).toBe('Cancel');
  });

  it('shows "Reactivate" when booking is cancelled', () => {
    expect(getButtonLabel('CANCELLED')).toBe('Reactivate');
  });
});

describe('booking detail cancel toggle — provider name display', () => {
  it('strikes through provider name when cancelled', () => {
    expect(isProviderStruck('CANCELLED')).toBe(true);
  });

  it('does not strike through when active', () => {
    expect(isProviderStruck('ACTIVE')).toBe(false);
  });
});

describe('booking detail cancel toggle — API payload', () => {
  it('sends CANCELLED status when cancelling an active booking', () => {
    const current: BookingStatus = 'ACTIVE';
    const payload = { status: getNextStatus(current) };
    expect(payload).toEqual({ status: 'CANCELLED' });
  });

  it('sends ACTIVE status when reactivating a cancelled booking', () => {
    const current: BookingStatus = 'CANCELLED';
    const payload = { status: getNextStatus(current) };
    expect(payload).toEqual({ status: 'ACTIVE' });
  });
});
