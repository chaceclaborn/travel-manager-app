import { describe, it, expect } from 'vitest';

// Pure logic helpers extracted from the cancel feature

function getNextStatus(currentStatus: string): string {
  return currentStatus === 'CANCELLED' ? 'ACTIVE' : 'CANCELLED';
}

function isCancelled(status: string): boolean {
  return status === 'CANCELLED';
}

function cancelToastMessage(nextStatus: string, success: boolean): string {
  if (success) {
    return nextStatus === 'CANCELLED' ? 'Booking cancelled' : 'Booking reactivated';
  }
  return nextStatus === 'CANCELLED' ? 'Failed to cancel booking' : 'Failed to reactivate booking';
}

describe('booking cancel status toggle', () => {
  it('toggles ACTIVE to CANCELLED', () => {
    expect(getNextStatus('ACTIVE')).toBe('CANCELLED');
  });

  it('toggles CANCELLED back to ACTIVE', () => {
    expect(getNextStatus('CANCELLED')).toBe('ACTIVE');
  });

  it('isCancelled returns true for CANCELLED status', () => {
    expect(isCancelled('CANCELLED')).toBe(true);
  });

  it('isCancelled returns false for ACTIVE status', () => {
    expect(isCancelled('ACTIVE')).toBe(false);
  });
});

describe('cancel toast messages', () => {
  it('shows correct message when cancelling succeeds', () => {
    expect(cancelToastMessage('CANCELLED', true)).toBe('Booking cancelled');
  });

  it('shows correct message when reactivating succeeds', () => {
    expect(cancelToastMessage('ACTIVE', true)).toBe('Booking reactivated');
  });

  it('shows correct error message when cancel fails', () => {
    expect(cancelToastMessage('CANCELLED', false)).toBe('Failed to cancel booking');
  });

  it('shows correct error message when reactivation fails', () => {
    expect(cancelToastMessage('ACTIVE', false)).toBe('Failed to reactivate booking');
  });
});
