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

function buildCancelPayload(nextStatus: BookingStatus): Record<string, string> {
  return { status: nextStatus };
}

function isCancelled(status: BookingStatus): boolean {
  return status === 'CANCELLED';
}

describe('booking detail page — cancel/reactivate toggle logic', () => {
  describe('getNextStatus', () => {
    it('toggles ACTIVE to CANCELLED', () => {
      expect(getNextStatus('ACTIVE')).toBe('CANCELLED');
    });

    it('toggles CANCELLED to ACTIVE', () => {
      expect(getNextStatus('CANCELLED')).toBe('ACTIVE');
    });
  });

  describe('getCancelToastMessage', () => {
    it('shows "Booking cancelled" when cancelling', () => {
      expect(getCancelToastMessage('CANCELLED')).toBe('Booking cancelled');
    });

    it('shows "Booking reactivated" when reactivating', () => {
      expect(getCancelToastMessage('ACTIVE')).toBe('Booking reactivated');
    });
  });

  describe('getCancelErrorMessage', () => {
    it('shows cancel error when next status is CANCELLED', () => {
      expect(getCancelErrorMessage('CANCELLED')).toBe('Failed to cancel booking');
    });

    it('shows reactivate error when next status is ACTIVE', () => {
      expect(getCancelErrorMessage('ACTIVE')).toBe('Failed to reactivate booking');
    });
  });

  describe('buildCancelPayload', () => {
    it('builds payload with CANCELLED status', () => {
      expect(buildCancelPayload('CANCELLED')).toEqual({ status: 'CANCELLED' });
    });

    it('builds payload with ACTIVE status', () => {
      expect(buildCancelPayload('ACTIVE')).toEqual({ status: 'ACTIVE' });
    });
  });

  describe('isCancelled display logic', () => {
    it('returns true for CANCELLED booking', () => {
      expect(isCancelled('CANCELLED')).toBe(true);
    });

    it('returns false for ACTIVE booking', () => {
      expect(isCancelled('ACTIVE')).toBe(false);
    });
  });

  describe('full cancel/reactivate flow', () => {
    it('ACTIVE booking: next status is CANCELLED, toast says cancelled', () => {
      const current: BookingStatus = 'ACTIVE';
      const next = getNextStatus(current);
      expect(next).toBe('CANCELLED');
      expect(getCancelToastMessage(next)).toBe('Booking cancelled');
      expect(buildCancelPayload(next)).toEqual({ status: 'CANCELLED' });
    });

    it('CANCELLED booking: next status is ACTIVE, toast says reactivated', () => {
      const current: BookingStatus = 'CANCELLED';
      const next = getNextStatus(current);
      expect(next).toBe('ACTIVE');
      expect(getCancelToastMessage(next)).toBe('Booking reactivated');
      expect(buildCancelPayload(next)).toEqual({ status: 'ACTIVE' });
    });

    it('double-toggle returns to original status', () => {
      const original: BookingStatus = 'ACTIVE';
      expect(getNextStatus(getNextStatus(original))).toBe(original);
    });
  });
});
