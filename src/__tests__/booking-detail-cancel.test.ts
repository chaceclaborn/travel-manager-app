import { describe, it, expect } from 'vitest';

// Mirror the cancel toggle logic from the booking detail page
function getNextStatus(current: 'ACTIVE' | 'CANCELLED'): 'ACTIVE' | 'CANCELLED' {
  return current === 'CANCELLED' ? 'ACTIVE' : 'CANCELLED';
}

function getCancelToastMessage(nextStatus: 'ACTIVE' | 'CANCELLED'): string {
  return nextStatus === 'CANCELLED' ? 'Booking cancelled' : 'Booking reactivated';
}

function getCancelErrorMessage(nextStatus: 'ACTIVE' | 'CANCELLED'): string {
  return nextStatus === 'CANCELLED' ? 'Failed to cancel booking' : 'Failed to reactivate booking';
}

function getCancelButtonLabel(status: 'ACTIVE' | 'CANCELLED'): string {
  return status === 'CANCELLED' ? 'Reactivate' : 'Cancel';
}

function getProviderNameClass(status: 'ACTIVE' | 'CANCELLED'): string {
  return status === 'CANCELLED' ? 'text-slate-400 line-through' : 'text-slate-800';
}

function getButtonColorClass(status: 'ACTIVE' | 'CANCELLED'): string {
  return status === 'CANCELLED'
    ? 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50'
    : 'text-amber-600 hover:text-amber-700 hover:bg-amber-50';
}

describe('booking detail page — cancel toggle logic', () => {
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
    it('shows failure message when cancel fails', () => {
      expect(getCancelErrorMessage('CANCELLED')).toBe('Failed to cancel booking');
    });

    it('shows failure message when reactivate fails', () => {
      expect(getCancelErrorMessage('ACTIVE')).toBe('Failed to reactivate booking');
    });
  });

  describe('getCancelButtonLabel', () => {
    it('shows "Cancel" for an active booking', () => {
      expect(getCancelButtonLabel('ACTIVE')).toBe('Cancel');
    });

    it('shows "Reactivate" for a cancelled booking', () => {
      expect(getCancelButtonLabel('CANCELLED')).toBe('Reactivate');
    });
  });

  describe('getProviderNameClass', () => {
    it('applies strikethrough for cancelled bookings', () => {
      const cls = getProviderNameClass('CANCELLED');
      expect(cls).toContain('line-through');
      expect(cls).toContain('text-slate-400');
    });

    it('applies normal text style for active bookings', () => {
      const cls = getProviderNameClass('ACTIVE');
      expect(cls).toContain('text-slate-800');
      expect(cls).not.toContain('line-through');
    });
  });

  describe('getButtonColorClass', () => {
    it('uses emerald (green) for reactivate button', () => {
      expect(getButtonColorClass('CANCELLED')).toContain('emerald');
    });

    it('uses amber for cancel button', () => {
      expect(getButtonColorClass('ACTIVE')).toContain('amber');
    });
  });

  describe('round-trip toggle', () => {
    it('double-toggle returns to original status', () => {
      expect(getNextStatus(getNextStatus('ACTIVE'))).toBe('ACTIVE');
      expect(getNextStatus(getNextStatus('CANCELLED'))).toBe('CANCELLED');
    });
  });
});
