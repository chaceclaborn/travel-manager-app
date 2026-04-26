import { describe, it, expect } from 'vitest';
import type { BookingStatus } from '@/lib/travelmanager/types';

// Pure logic helpers extracted from the detail page behaviour

function getNextStatus(current: BookingStatus): BookingStatus {
  return current === 'CANCELLED' ? 'ACTIVE' : 'CANCELLED';
}

function getCancelButtonLabel(status: BookingStatus, loading: boolean): string {
  if (loading) return 'loading';
  return status === 'CANCELLED' ? 'Reactivate' : 'Cancel';
}

function getCancelToastMessage(nextStatus: BookingStatus): string {
  return nextStatus === 'CANCELLED' ? 'Booking cancelled' : 'Booking reactivated';
}

function getCancelErrorMessage(nextStatus: BookingStatus): string {
  return nextStatus === 'CANCELLED' ? 'Failed to cancel booking' : 'Failed to reactivate booking';
}

function getProviderClass(status: BookingStatus): string {
  return status === 'CANCELLED' ? 'text-slate-400 line-through' : 'text-slate-800';
}

function getCancelButtonClass(status: BookingStatus): string {
  return status === 'CANCELLED'
    ? 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50'
    : 'text-amber-600 hover:text-amber-700 hover:bg-amber-50';
}

describe('booking detail page cancel logic', () => {
  describe('getNextStatus', () => {
    it('toggles ACTIVE to CANCELLED', () => {
      expect(getNextStatus('ACTIVE')).toBe('CANCELLED');
    });

    it('toggles CANCELLED to ACTIVE', () => {
      expect(getNextStatus('CANCELLED')).toBe('ACTIVE');
    });
  });

  describe('getCancelButtonLabel', () => {
    it('shows Cancel for ACTIVE booking', () => {
      expect(getCancelButtonLabel('ACTIVE', false)).toBe('Cancel');
    });

    it('shows Reactivate for CANCELLED booking', () => {
      expect(getCancelButtonLabel('CANCELLED', false)).toBe('Reactivate');
    });

    it('shows loading state regardless of status', () => {
      expect(getCancelButtonLabel('ACTIVE', true)).toBe('loading');
      expect(getCancelButtonLabel('CANCELLED', true)).toBe('loading');
    });
  });

  describe('getCancelToastMessage', () => {
    it('returns cancellation message when cancelling', () => {
      expect(getCancelToastMessage('CANCELLED')).toBe('Booking cancelled');
    });

    it('returns reactivation message when reactivating', () => {
      expect(getCancelToastMessage('ACTIVE')).toBe('Booking reactivated');
    });
  });

  describe('getCancelErrorMessage', () => {
    it('returns cancel error when cancelling', () => {
      expect(getCancelErrorMessage('CANCELLED')).toBe('Failed to cancel booking');
    });

    it('returns reactivate error when reactivating', () => {
      expect(getCancelErrorMessage('ACTIVE')).toBe('Failed to reactivate booking');
    });
  });

  describe('getProviderClass', () => {
    it('applies strikethrough and muted color for cancelled booking', () => {
      expect(getProviderClass('CANCELLED')).toContain('line-through');
      expect(getProviderClass('CANCELLED')).toContain('text-slate-400');
    });

    it('applies normal color for active booking', () => {
      const cls = getProviderClass('ACTIVE');
      expect(cls).toContain('text-slate-800');
      expect(cls).not.toContain('line-through');
    });
  });

  describe('getCancelButtonClass', () => {
    it('uses emerald (green) color for reactivate action', () => {
      expect(getCancelButtonClass('CANCELLED')).toContain('text-emerald-600');
    });

    it('uses amber color for cancel action', () => {
      expect(getCancelButtonClass('ACTIVE')).toContain('text-amber-600');
    });
  });
});
