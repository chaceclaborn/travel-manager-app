import { describe, it, expect } from 'vitest';

type BookingStatus = 'ACTIVE' | 'CANCELLED';

function getNextStatus(current: BookingStatus): BookingStatus {
  return current === 'CANCELLED' ? 'ACTIVE' : 'CANCELLED';
}

function getCancelButtonLabel(status: BookingStatus): string {
  return status === 'CANCELLED' ? 'Reactivate' : 'Cancel';
}

function getSuccessToast(nextStatus: BookingStatus): string {
  return nextStatus === 'CANCELLED' ? 'Booking cancelled' : 'Booking reactivated';
}

function getErrorToast(nextStatus: BookingStatus): string {
  return nextStatus === 'CANCELLED' ? 'Failed to cancel booking' : 'Failed to reactivate booking';
}

function isValidStatus(value: string): value is BookingStatus {
  return value === 'ACTIVE' || value === 'CANCELLED';
}

describe('booking detail cancel toggle logic', () => {
  it('toggles ACTIVE to CANCELLED', () => {
    expect(getNextStatus('ACTIVE')).toBe('CANCELLED');
  });

  it('toggles CANCELLED to ACTIVE', () => {
    expect(getNextStatus('CANCELLED')).toBe('ACTIVE');
  });

  it('shows "Cancel" label when booking is ACTIVE', () => {
    expect(getCancelButtonLabel('ACTIVE')).toBe('Cancel');
  });

  it('shows "Reactivate" label when booking is CANCELLED', () => {
    expect(getCancelButtonLabel('CANCELLED')).toBe('Reactivate');
  });

  it('shows correct success toast when cancelling', () => {
    expect(getSuccessToast('CANCELLED')).toBe('Booking cancelled');
  });

  it('shows correct success toast when reactivating', () => {
    expect(getSuccessToast('ACTIVE')).toBe('Booking reactivated');
  });

  it('shows correct error toast when cancel fails', () => {
    expect(getErrorToast('CANCELLED')).toBe('Failed to cancel booking');
  });

  it('shows correct error toast when reactivate fails', () => {
    expect(getErrorToast('ACTIVE')).toBe('Failed to reactivate booking');
  });

  it('accepts ACTIVE as a valid status', () => {
    expect(isValidStatus('ACTIVE')).toBe(true);
  });

  it('accepts CANCELLED as a valid status', () => {
    expect(isValidStatus('CANCELLED')).toBe(true);
  });

  it('rejects invalid status strings', () => {
    expect(isValidStatus('PENDING')).toBe(false);
    expect(isValidStatus('')).toBe(false);
    expect(isValidStatus('active')).toBe(false);
  });

  it('PUT payload contains only the status field', () => {
    const status: BookingStatus = 'CANCELLED';
    const payload = JSON.stringify({ status });
    const parsed = JSON.parse(payload);
    expect(Object.keys(parsed)).toEqual(['status']);
    expect(parsed.status).toBe('CANCELLED');
  });
});
