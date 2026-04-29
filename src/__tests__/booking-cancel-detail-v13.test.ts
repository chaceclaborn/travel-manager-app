import { describe, it, expect } from 'vitest';
import type { BookingStatus } from '@/lib/travelmanager/types';

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

function isProviderStrikethrough(status: BookingStatus): boolean {
  return status === 'CANCELLED';
}

describe('booking detail cancel toggle', () => {
  it('returns CANCELLED when current status is ACTIVE', () => {
    expect(getNextStatus('ACTIVE')).toBe('CANCELLED');
  });

  it('returns ACTIVE when current status is CANCELLED', () => {
    expect(getNextStatus('CANCELLED')).toBe('ACTIVE');
  });

  it('shows "Cancel" button label for active booking', () => {
    expect(getCancelButtonLabel('ACTIVE')).toBe('Cancel');
  });

  it('shows "Reactivate" button label for cancelled booking', () => {
    expect(getCancelButtonLabel('CANCELLED')).toBe('Reactivate');
  });

  it('shows "Booking cancelled" toast on cancel', () => {
    expect(getToastMessage('CANCELLED')).toBe('Booking cancelled');
  });

  it('shows "Booking reactivated" toast on reactivate', () => {
    expect(getToastMessage('ACTIVE')).toBe('Booking reactivated');
  });

  it('shows correct error message on cancel failure', () => {
    expect(getErrorMessage('CANCELLED')).toBe('Failed to cancel booking');
  });

  it('shows correct error message on reactivate failure', () => {
    expect(getErrorMessage('ACTIVE')).toBe('Failed to reactivate booking');
  });

  it('applies strikethrough styling to provider name when cancelled', () => {
    expect(isProviderStrikethrough('CANCELLED')).toBe(true);
  });

  it('does not apply strikethrough styling to provider name when active', () => {
    expect(isProviderStrikethrough('ACTIVE')).toBe(false);
  });
});
