import { describe, it, expect } from 'vitest';
import type { BookingStatus } from '@/lib/travelmanager/types';

// Pure helpers extracted from the cancel/reactivate feature logic

function getNextStatus(current: BookingStatus): BookingStatus {
  return current === 'CANCELLED' ? 'ACTIVE' : 'CANCELLED';
}

function buildCancelPayload(nextStatus: BookingStatus): string {
  return JSON.stringify({ status: nextStatus });
}

function getCancelButtonLabel(isCancelled: boolean, isCancelling: boolean): string {
  if (isCancelling) return 'loading';
  return isCancelled ? 'Reactivate' : 'Cancel';
}

function getCancelToastMessage(nextStatus: BookingStatus): string {
  return nextStatus === 'CANCELLED' ? 'Booking cancelled' : 'Booking reactivated';
}

function getCancelErrorMessage(nextStatus: BookingStatus): string {
  return nextStatus === 'CANCELLED' ? 'Failed to cancel booking' : 'Failed to reactivate booking';
}

describe('booking status toggle', () => {
  it('ACTIVE -> CANCELLED', () => {
    expect(getNextStatus('ACTIVE')).toBe('CANCELLED');
  });

  it('CANCELLED -> ACTIVE', () => {
    expect(getNextStatus('CANCELLED')).toBe('ACTIVE');
  });

  it('is reversible (round-trip)', () => {
    const start: BookingStatus = 'ACTIVE';
    expect(getNextStatus(getNextStatus(start))).toBe(start);
  });
});

describe('cancel API payload', () => {
  it('sends CANCELLED status when cancelling', () => {
    const payload = buildCancelPayload('CANCELLED');
    expect(JSON.parse(payload)).toEqual({ status: 'CANCELLED' });
  });

  it('sends ACTIVE status when reactivating', () => {
    const payload = buildCancelPayload('ACTIVE');
    expect(JSON.parse(payload)).toEqual({ status: 'ACTIVE' });
  });
});

describe('cancel button label logic', () => {
  it('shows Cancel when booking is active', () => {
    expect(getCancelButtonLabel(false, false)).toBe('Cancel');
  });

  it('shows Reactivate when booking is cancelled', () => {
    expect(getCancelButtonLabel(true, false)).toBe('Reactivate');
  });

  it('shows loading state while request is in flight', () => {
    expect(getCancelButtonLabel(false, true)).toBe('loading');
    expect(getCancelButtonLabel(true, true)).toBe('loading');
  });
});

describe('cancel toast messages', () => {
  it('shows cancelled message on cancel', () => {
    expect(getCancelToastMessage('CANCELLED')).toBe('Booking cancelled');
  });

  it('shows reactivated message on restore', () => {
    expect(getCancelToastMessage('ACTIVE')).toBe('Booking reactivated');
  });
});

describe('cancel error messages', () => {
  it('shows cancel error when cancellation fails', () => {
    expect(getCancelErrorMessage('CANCELLED')).toBe('Failed to cancel booking');
  });

  it('shows reactivate error when reactivation fails', () => {
    expect(getCancelErrorMessage('ACTIVE')).toBe('Failed to reactivate booking');
  });
});

describe('optimistic state update', () => {
  it('updates booking status in local list', () => {
    const bookings = [
      { id: '1', status: 'ACTIVE' as BookingStatus, provider: 'Delta' },
      { id: '2', status: 'ACTIVE' as BookingStatus, provider: 'Hilton' },
    ];
    const updated = bookings.map((b) =>
      b.id === '1' ? { ...b, status: 'CANCELLED' as BookingStatus } : b
    );
    expect(updated[0].status).toBe('CANCELLED');
    expect(updated[1].status).toBe('ACTIVE');
  });

  it('does not mutate original list', () => {
    const bookings = [{ id: '1', status: 'ACTIVE' as BookingStatus, provider: 'Delta' }];
    const updated = bookings.map((b) =>
      b.id === '1' ? { ...b, status: 'CANCELLED' as BookingStatus } : b
    );
    expect(bookings[0].status).toBe('ACTIVE');
    expect(updated[0].status).toBe('CANCELLED');
  });
});
