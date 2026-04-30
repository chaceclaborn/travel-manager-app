import { describe, it, expect } from 'vitest';

// Pure logic extracted from the booking detail page cancel feature.
// These helpers mirror what the component does inline.

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

function getButtonLabel(isCancelled: boolean): string {
  return isCancelled ? 'Reactivate' : 'Cancel';
}

function getProviderTextClass(isCancelled: boolean): string {
  return isCancelled ? 'text-slate-500 line-through' : 'text-slate-800';
}

describe('booking detail page — cancel toggle logic', () => {
  describe('getNextStatus', () => {
    it('toggles ACTIVE to CANCELLED', () => {
      expect(getNextStatus('ACTIVE')).toBe('CANCELLED');
    });

    it('toggles CANCELLED back to ACTIVE', () => {
      expect(getNextStatus('CANCELLED')).toBe('ACTIVE');
    });
  });

  describe('getCancelToastMessage', () => {
    it('shows cancelled message when cancelling', () => {
      expect(getCancelToastMessage('CANCELLED')).toBe('Booking cancelled');
    });

    it('shows reactivated message when reactivating', () => {
      expect(getCancelToastMessage('ACTIVE')).toBe('Booking reactivated');
    });
  });

  describe('getCancelErrorMessage', () => {
    it('shows cancel error message when cancelling fails', () => {
      expect(getCancelErrorMessage('CANCELLED')).toBe('Failed to cancel booking');
    });

    it('shows reactivate error message when reactivating fails', () => {
      expect(getCancelErrorMessage('ACTIVE')).toBe('Failed to reactivate booking');
    });
  });

  describe('getButtonLabel', () => {
    it('shows "Cancel" when booking is active', () => {
      expect(getButtonLabel(false)).toBe('Cancel');
    });

    it('shows "Reactivate" when booking is cancelled', () => {
      expect(getButtonLabel(true)).toBe('Reactivate');
    });
  });

  describe('getProviderTextClass', () => {
    it('uses line-through style for cancelled bookings', () => {
      const cls = getProviderTextClass(true);
      expect(cls).toContain('line-through');
      expect(cls).toContain('text-slate-500');
    });

    it('uses normal bold style for active bookings', () => {
      const cls = getProviderTextClass(false);
      expect(cls).toContain('text-slate-800');
      expect(cls).not.toContain('line-through');
    });
  });

  describe('toggle round-trip', () => {
    it('ACTIVE → CANCELLED → ACTIVE round-trips correctly', () => {
      const start: BookingStatus = 'ACTIVE';
      const cancelled = getNextStatus(start);
      const restored = getNextStatus(cancelled);
      expect(cancelled).toBe('CANCELLED');
      expect(restored).toBe('ACTIVE');
    });
  });
});
