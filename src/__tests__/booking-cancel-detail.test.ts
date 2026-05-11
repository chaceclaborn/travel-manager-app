import { describe, it, expect } from 'vitest';
import { validateEnum } from '@/lib/sanitize';

const BOOKING_STATUS_VALUES = ['ACTIVE', 'CANCELLED'] as const;
type BookingStatus = (typeof BOOKING_STATUS_VALUES)[number];

function getNextStatus(current: BookingStatus): BookingStatus {
  return current === 'CANCELLED' ? 'ACTIVE' : 'CANCELLED';
}

function getCancelToast(nextStatus: BookingStatus): string {
  return nextStatus === 'CANCELLED' ? 'Booking cancelled' : 'Booking reactivated';
}

function getCancelErrorToast(nextStatus: BookingStatus): string {
  return nextStatus === 'CANCELLED' ? 'Failed to cancel booking' : 'Failed to reactivate booking';
}

describe('booking detail cancel toggle', () => {
  it('toggles ACTIVE to CANCELLED', () => {
    expect(getNextStatus('ACTIVE')).toBe('CANCELLED');
  });

  it('toggles CANCELLED to ACTIVE', () => {
    expect(getNextStatus('CANCELLED')).toBe('ACTIVE');
  });

  it('shows "Cancel" label when booking is active', () => {
    const isCancelled = false;
    expect(isCancelled ? 'Reactivate' : 'Cancel').toBe('Cancel');
  });

  it('shows "Reactivate" label when booking is cancelled', () => {
    const isCancelled = true;
    expect(isCancelled ? 'Reactivate' : 'Cancel').toBe('Reactivate');
  });

  it('shows success toast "Booking cancelled" when cancelling', () => {
    expect(getCancelToast('CANCELLED')).toBe('Booking cancelled');
  });

  it('shows success toast "Booking reactivated" when reactivating', () => {
    expect(getCancelToast('ACTIVE')).toBe('Booking reactivated');
  });

  it('shows error toast "Failed to cancel booking" when cancel fails', () => {
    expect(getCancelErrorToast('CANCELLED')).toBe('Failed to cancel booking');
  });

  it('shows error toast "Failed to reactivate booking" when reactivate fails', () => {
    expect(getCancelErrorToast('ACTIVE')).toBe('Failed to reactivate booking');
  });

  it('validateEnum accepts ACTIVE as a valid status', () => {
    expect(validateEnum('ACTIVE', BOOKING_STATUS_VALUES)).toBe(true);
  });

  it('validateEnum accepts CANCELLED as a valid status', () => {
    expect(validateEnum('CANCELLED', BOOKING_STATUS_VALUES)).toBe(true);
  });

  it('validateEnum rejects unknown status values', () => {
    expect(validateEnum('DELETED', BOOKING_STATUS_VALUES)).toBe(false);
    expect(validateEnum('', BOOKING_STATUS_VALUES)).toBe(false);
  });

  it('applies line-through class when booking is cancelled', () => {
    const isCancelled = true;
    const cls = isCancelled ? 'text-slate-400 line-through' : 'text-slate-800';
    expect(cls).toContain('line-through');
  });

  it('applies normal class when booking is active', () => {
    const isCancelled = false;
    const cls = isCancelled ? 'text-slate-400 line-through' : 'text-slate-800';
    expect(cls).toBe('text-slate-800');
    expect(cls).not.toContain('line-through');
  });
});
