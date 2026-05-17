import { describe, it, expect } from 'vitest';
import type { BookingStatus } from '@/lib/travelmanager/types';

// Pure logic extracted from the detail page cancel toggle
function getNextStatus(current: BookingStatus): BookingStatus {
  return current === 'CANCELLED' ? 'ACTIVE' : 'CANCELLED';
}

function getCancelButtonLabel(current: BookingStatus): string {
  return current === 'CANCELLED' ? 'Reactivate' : 'Cancel';
}

function getSuccessToast(nextStatus: BookingStatus): string {
  return nextStatus === 'CANCELLED' ? 'Booking cancelled' : 'Booking reactivated';
}

function getErrorToast(nextStatus: BookingStatus): string {
  return nextStatus === 'CANCELLED' ? 'Failed to cancel booking' : 'Failed to reactivate booking';
}

function getProviderNameClass(status: BookingStatus): string {
  return status === 'CANCELLED' ? 'text-slate-400 line-through' : 'text-slate-800';
}

function isCancelledBadgeVisible(status: BookingStatus): boolean {
  return status === 'CANCELLED';
}

function buildCancelPayload(nextStatus: BookingStatus): Record<string, string> {
  return { status: nextStatus };
}

describe('booking detail cancel toggle logic', () => {
  it('toggles ACTIVE to CANCELLED', () => {
    expect(getNextStatus('ACTIVE')).toBe('CANCELLED');
  });

  it('toggles CANCELLED to ACTIVE', () => {
    expect(getNextStatus('CANCELLED')).toBe('ACTIVE');
  });

  it('shows "Cancel" button label for active bookings', () => {
    expect(getCancelButtonLabel('ACTIVE')).toBe('Cancel');
  });

  it('shows "Reactivate" button label for cancelled bookings', () => {
    expect(getCancelButtonLabel('CANCELLED')).toBe('Reactivate');
  });

  it('shows success toast "Booking cancelled" when cancelling', () => {
    expect(getSuccessToast('CANCELLED')).toBe('Booking cancelled');
  });

  it('shows success toast "Booking reactivated" when reactivating', () => {
    expect(getSuccessToast('ACTIVE')).toBe('Booking reactivated');
  });

  it('shows error toast for failed cancel', () => {
    expect(getErrorToast('CANCELLED')).toBe('Failed to cancel booking');
  });

  it('shows error toast for failed reactivate', () => {
    expect(getErrorToast('ACTIVE')).toBe('Failed to reactivate booking');
  });

  it('applies strikethrough and grey class to provider name when cancelled', () => {
    expect(getProviderNameClass('CANCELLED')).toContain('line-through');
    expect(getProviderNameClass('CANCELLED')).toContain('text-slate-400');
  });

  it('applies normal class to provider name when active', () => {
    expect(getProviderNameClass('ACTIVE')).toBe('text-slate-800');
    expect(getProviderNameClass('ACTIVE')).not.toContain('line-through');
  });

  it('shows cancelled badge only when cancelled', () => {
    expect(isCancelledBadgeVisible('CANCELLED')).toBe(true);
    expect(isCancelledBadgeVisible('ACTIVE')).toBe(false);
  });

  it('builds correct PUT payload with next status', () => {
    expect(buildCancelPayload('CANCELLED')).toEqual({ status: 'CANCELLED' });
    expect(buildCancelPayload('ACTIVE')).toEqual({ status: 'ACTIVE' });
  });
});
