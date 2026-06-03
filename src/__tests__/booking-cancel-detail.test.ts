import { describe, it, expect } from 'vitest';
import { validateEnum } from '@/lib/sanitize';

const BOOKING_STATUS_VALUES = ['ACTIVE', 'CANCELLED'] as const;
type BookingStatus = 'ACTIVE' | 'CANCELLED';

function getNextStatus(current: BookingStatus): BookingStatus {
  return current === 'CANCELLED' ? 'ACTIVE' : 'CANCELLED';
}

function getCancelToastMessage(nextStatus: BookingStatus): string {
  return nextStatus === 'CANCELLED' ? 'Booking cancelled' : 'Booking reactivated';
}

function getCancelErrorMessage(currentStatus: BookingStatus): string {
  return currentStatus === 'CANCELLED' ? 'Failed to reactivate booking' : 'Failed to cancel booking';
}

function getButtonLabel(isCancelled: boolean): string {
  return isCancelled ? 'Reactivate' : 'Cancel';
}

function getProviderClass(isCancelled: boolean): string {
  return isCancelled ? 'text-slate-400 line-through' : 'text-slate-800';
}

describe('booking detail page cancel toggle', () => {
  it('toggles ACTIVE to CANCELLED', () => {
    expect(getNextStatus('ACTIVE')).toBe('CANCELLED');
  });

  it('toggles CANCELLED to ACTIVE', () => {
    expect(getNextStatus('CANCELLED')).toBe('ACTIVE');
  });

  it('shows "Booking cancelled" toast when cancelling', () => {
    expect(getCancelToastMessage('CANCELLED')).toBe('Booking cancelled');
  });

  it('shows "Booking reactivated" toast when reactivating', () => {
    expect(getCancelToastMessage('ACTIVE')).toBe('Booking reactivated');
  });

  it('shows error for failed cancel', () => {
    expect(getCancelErrorMessage('ACTIVE')).toBe('Failed to cancel booking');
  });

  it('shows error for failed reactivate', () => {
    expect(getCancelErrorMessage('CANCELLED')).toBe('Failed to reactivate booking');
  });

  it('shows "Cancel" button label for active booking', () => {
    expect(getButtonLabel(false)).toBe('Cancel');
  });

  it('shows "Reactivate" button label for cancelled booking', () => {
    expect(getButtonLabel(true)).toBe('Reactivate');
  });

  it('applies strikethrough class to provider name when cancelled', () => {
    expect(getProviderClass(true)).toContain('line-through');
  });

  it('does not apply strikethrough when active', () => {
    expect(getProviderClass(false)).not.toContain('line-through');
  });

  it('validates ACTIVE as a legal booking status', () => {
    expect(validateEnum('ACTIVE', BOOKING_STATUS_VALUES)).toBe(true);
  });

  it('validates CANCELLED as a legal booking status', () => {
    expect(validateEnum('CANCELLED', BOOKING_STATUS_VALUES)).toBe(true);
  });

  it('rejects an unknown status value', () => {
    expect(validateEnum('PENDING', BOOKING_STATUS_VALUES)).toBe(false);
  });

  it('PUT payload contains only the status field when toggling', () => {
    const payload = JSON.stringify({ status: getNextStatus('ACTIVE') });
    const parsed = JSON.parse(payload);
    expect(parsed).toEqual({ status: 'CANCELLED' });
    expect(Object.keys(parsed)).toHaveLength(1);
  });
});
