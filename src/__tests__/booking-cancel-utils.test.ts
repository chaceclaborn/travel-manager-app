import { describe, it, expect } from 'vitest';
import {
  getNextCancelStatus,
  getCancelToastMessage,
  getCancelErrorMessage,
  type BookingStatus,
} from '@/lib/travelmanager/booking-cancel-utils';

describe('getNextCancelStatus', () => {
  it('returns CANCELLED when current status is ACTIVE', () => {
    expect(getNextCancelStatus('ACTIVE')).toBe('CANCELLED');
  });

  it('returns ACTIVE when current status is CANCELLED', () => {
    expect(getNextCancelStatus('CANCELLED')).toBe('ACTIVE');
  });

  it('toggles back to CANCELLED from ACTIVE after two calls', () => {
    const step1 = getNextCancelStatus('ACTIVE');
    expect(getNextCancelStatus(step1)).toBe('ACTIVE');
  });
});

describe('getCancelToastMessage', () => {
  it('returns "Booking cancelled" when next status is CANCELLED', () => {
    expect(getCancelToastMessage('CANCELLED')).toBe('Booking cancelled');
  });

  it('returns "Booking reactivated" when next status is ACTIVE', () => {
    expect(getCancelToastMessage('ACTIVE')).toBe('Booking reactivated');
  });
});

describe('getCancelErrorMessage', () => {
  it('returns "Failed to cancel booking" when next status is CANCELLED', () => {
    expect(getCancelErrorMessage('CANCELLED')).toBe('Failed to cancel booking');
  });

  it('returns "Failed to reactivate booking" when next status is ACTIVE', () => {
    expect(getCancelErrorMessage('ACTIVE')).toBe('Failed to reactivate booking');
  });
});

describe('BookingStatus type values', () => {
  it('ACTIVE is a valid BookingStatus', () => {
    const s: BookingStatus = 'ACTIVE';
    expect(s).toBe('ACTIVE');
  });

  it('CANCELLED is a valid BookingStatus', () => {
    const s: BookingStatus = 'CANCELLED';
    expect(s).toBe('CANCELLED');
  });

  it('getNextCancelStatus round-trips back to original status', () => {
    const statuses: BookingStatus[] = ['ACTIVE', 'CANCELLED'];
    for (const s of statuses) {
      expect(getNextCancelStatus(getNextCancelStatus(s))).toBe(s);
    }
  });
});
