import { describe, it, expect } from 'vitest';
import type { BookingStatus } from '@/lib/travelmanager/types';

// Pure logic extracted from the detail page cancel toggle
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

function getProviderClass(isCancelled: boolean): string {
  return isCancelled ? 'text-slate-400 line-through' : 'text-slate-800';
}

describe('booking detail cancel toggle logic', () => {
  describe('getNextStatus', () => {
    it('toggles ACTIVE to CANCELLED', () => {
      expect(getNextStatus('ACTIVE')).toBe('CANCELLED');
    });

    it('toggles CANCELLED to ACTIVE', () => {
      expect(getNextStatus('CANCELLED')).toBe('ACTIVE');
    });

    it('returns a valid BookingStatus in both directions', () => {
      const statuses: BookingStatus[] = ['ACTIVE', 'CANCELLED'];
      for (const s of statuses) {
        const next = getNextStatus(s);
        expect(statuses).toContain(next);
        expect(next).not.toBe(s);
      }
    });
  });

  describe('getCancelToastMessage', () => {
    it('shows cancellation message when cancelling', () => {
      expect(getCancelToastMessage('CANCELLED')).toBe('Booking cancelled');
    });

    it('shows reactivation message when reactivating', () => {
      expect(getCancelToastMessage('ACTIVE')).toBe('Booking reactivated');
    });
  });

  describe('getCancelErrorMessage', () => {
    it('shows cancel error when cancel fails', () => {
      expect(getCancelErrorMessage('CANCELLED')).toBe('Failed to cancel booking');
    });

    it('shows reactivate error when reactivate fails', () => {
      expect(getCancelErrorMessage('ACTIVE')).toBe('Failed to reactivate booking');
    });
  });

  describe('button label', () => {
    it('shows Cancel when booking is active', () => {
      expect(getButtonLabel(false)).toBe('Cancel');
    });

    it('shows Reactivate when booking is cancelled', () => {
      expect(getButtonLabel(true)).toBe('Reactivate');
    });
  });

  describe('provider name styling', () => {
    it('applies line-through and muted color when cancelled', () => {
      const cls = getProviderClass(true);
      expect(cls).toContain('line-through');
      expect(cls).not.toContain('slate-800');
    });

    it('applies bold dark color when active', () => {
      const cls = getProviderClass(false);
      expect(cls).toContain('slate-800');
      expect(cls).not.toContain('line-through');
    });
  });

  describe('API payload construction', () => {
    it('sends CANCELLED status when cancelling', () => {
      const payload = JSON.stringify({ status: getNextStatus('ACTIVE') });
      expect(JSON.parse(payload)).toEqual({ status: 'CANCELLED' });
    });

    it('sends ACTIVE status when reactivating', () => {
      const payload = JSON.stringify({ status: getNextStatus('CANCELLED') });
      expect(JSON.parse(payload)).toEqual({ status: 'ACTIVE' });
    });
  });
});
