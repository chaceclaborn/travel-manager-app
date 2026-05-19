import { describe, it, expect } from 'vitest';

type BookingStatus = 'ACTIVE' | 'CANCELLED';

const BOOKING_STATUS_VALUES: readonly BookingStatus[] = ['ACTIVE', 'CANCELLED'];

function toggleStatus(current: BookingStatus): BookingStatus {
  return current === 'CANCELLED' ? 'ACTIVE' : 'CANCELLED';
}

function validateBookingStatus(value: string): value is BookingStatus {
  return (BOOKING_STATUS_VALUES as readonly string[]).includes(value);
}

describe('booking detail cancel/reactivate logic', () => {
  describe('toggleStatus', () => {
    it('toggles ACTIVE to CANCELLED', () => {
      expect(toggleStatus('ACTIVE')).toBe('CANCELLED');
    });

    it('toggles CANCELLED back to ACTIVE', () => {
      expect(toggleStatus('CANCELLED')).toBe('ACTIVE');
    });

    it('is its own inverse', () => {
      expect(toggleStatus(toggleStatus('ACTIVE'))).toBe('ACTIVE');
      expect(toggleStatus(toggleStatus('CANCELLED'))).toBe('CANCELLED');
    });
  });

  describe('validateBookingStatus', () => {
    it('accepts ACTIVE', () => {
      expect(validateBookingStatus('ACTIVE')).toBe(true);
    });

    it('accepts CANCELLED', () => {
      expect(validateBookingStatus('CANCELLED')).toBe(true);
    });

    it('rejects arbitrary strings', () => {
      expect(validateBookingStatus('PENDING')).toBe(false);
      expect(validateBookingStatus('DELETED')).toBe(false);
      expect(validateBookingStatus('')).toBe(false);
      expect(validateBookingStatus('active')).toBe(false);
    });

    it('rejects injection attempts', () => {
      expect(validateBookingStatus('<script>alert(1)</script>')).toBe(false);
      expect(validateBookingStatus("'; DROP TABLE bookings;--")).toBe(false);
    });
  });

  describe('isCancelled derived state', () => {
    it('is true when status is CANCELLED', () => {
      const booking = { status: 'CANCELLED' as BookingStatus };
      expect(booking.status === 'CANCELLED').toBe(true);
    });

    it('is false when status is ACTIVE', () => {
      const booking = { status: 'ACTIVE' as BookingStatus };
      expect(booking.status === 'CANCELLED').toBe(false);
    });
  });

  describe('toast message selection', () => {
    function toastMessage(nextStatus: BookingStatus): string {
      return nextStatus === 'CANCELLED' ? 'Booking cancelled' : 'Booking reactivated';
    }

    it('shows "Booking cancelled" when cancelling', () => {
      expect(toastMessage('CANCELLED')).toBe('Booking cancelled');
    });

    it('shows "Booking reactivated" when reactivating', () => {
      expect(toastMessage('ACTIVE')).toBe('Booking reactivated');
    });
  });
});
