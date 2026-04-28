import { describe, it, expect } from 'vitest';
import type { BookingStatus } from '@/lib/travelmanager/types';

// Pure helpers mirroring the logic in /bookings/[id]/page.tsx

function getNextStatus(current: BookingStatus): BookingStatus {
  return current === 'CANCELLED' ? 'ACTIVE' : 'CANCELLED';
}

function getCancelToastMessage(nextStatus: BookingStatus): string {
  return nextStatus === 'CANCELLED' ? 'Booking cancelled' : 'Booking reactivated';
}

function getCancelErrorMessage(nextStatus: BookingStatus): string {
  return nextStatus === 'CANCELLED' ? 'Failed to cancel booking' : 'Failed to reactivate booking';
}

function isCancelled(status: BookingStatus): boolean {
  return status === 'CANCELLED';
}

function getButtonLabel(status: BookingStatus): string {
  return status === 'CANCELLED' ? 'Reactivate' : 'Cancel';
}

function getProviderNameClass(status: BookingStatus): string {
  return status === 'CANCELLED' ? 'text-slate-500 line-through' : 'text-slate-800';
}

describe('booking detail cancel toggle — status transition', () => {
  it('toggles ACTIVE → CANCELLED', () => {
    expect(getNextStatus('ACTIVE')).toBe('CANCELLED');
  });

  it('toggles CANCELLED → ACTIVE', () => {
    expect(getNextStatus('CANCELLED')).toBe('ACTIVE');
  });
});

describe('booking detail cancel toggle — toast messages', () => {
  it('shows "Booking cancelled" when cancelling', () => {
    expect(getCancelToastMessage('CANCELLED')).toBe('Booking cancelled');
  });

  it('shows "Booking reactivated" when reactivating', () => {
    expect(getCancelToastMessage('ACTIVE')).toBe('Booking reactivated');
  });
});

describe('booking detail cancel toggle — error messages', () => {
  it('shows cancel error when cancel fails', () => {
    expect(getCancelErrorMessage('CANCELLED')).toBe('Failed to cancel booking');
  });

  it('shows reactivate error when reactivate fails', () => {
    expect(getCancelErrorMessage('ACTIVE')).toBe('Failed to reactivate booking');
  });
});

describe('booking detail cancel toggle — display logic', () => {
  it('isCancelled returns true for CANCELLED status', () => {
    expect(isCancelled('CANCELLED')).toBe(true);
  });

  it('isCancelled returns false for ACTIVE status', () => {
    expect(isCancelled('ACTIVE')).toBe(false);
  });

  it('button label is "Cancel" for active booking', () => {
    expect(getButtonLabel('ACTIVE')).toBe('Cancel');
  });

  it('button label is "Reactivate" for cancelled booking', () => {
    expect(getButtonLabel('CANCELLED')).toBe('Reactivate');
  });

  it('provider name has line-through class when cancelled', () => {
    expect(getProviderNameClass('CANCELLED')).toContain('line-through');
  });

  it('provider name has no line-through class when active', () => {
    expect(getProviderNameClass('ACTIVE')).not.toContain('line-through');
  });
});
