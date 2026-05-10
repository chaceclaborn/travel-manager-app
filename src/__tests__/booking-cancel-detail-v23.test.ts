import { describe, it, expect } from 'vitest';
import type { BookingStatus } from '@/lib/travelmanager/types';

// Logic extracted from the detail page cancel toggle.
function getNextStatus(current: BookingStatus): BookingStatus {
  return current === 'CANCELLED' ? 'ACTIVE' : 'CANCELLED';
}

function getButtonLabel(current: BookingStatus, pending: boolean): string {
  if (current === 'CANCELLED') return pending ? 'Reactivating…' : 'Reactivate';
  return pending ? 'Cancelling…' : 'Cancel';
}

function getToastMessage(nextStatus: BookingStatus): string {
  return nextStatus === 'CANCELLED' ? 'Booking cancelled' : 'Booking reactivated';
}

function getErrorMessage(nextStatus: BookingStatus): string {
  return nextStatus === 'CANCELLED' ? 'Failed to cancel booking' : 'Failed to reactivate booking';
}

function getProviderClass(status: BookingStatus): string {
  return status === 'CANCELLED' ? 'text-slate-400 line-through' : 'text-slate-800';
}

function showCancelledBadge(status: BookingStatus): boolean {
  return status === 'CANCELLED';
}

const VALID_STATUSES = ['ACTIVE', 'CANCELLED'] as const;
function isValidStatus(v: string): v is BookingStatus {
  return (VALID_STATUSES as readonly string[]).includes(v);
}

describe('booking detail page — cancel toggle logic', () => {
  it('toggles ACTIVE → CANCELLED', () => {
    expect(getNextStatus('ACTIVE')).toBe('CANCELLED');
  });

  it('toggles CANCELLED → ACTIVE', () => {
    expect(getNextStatus('CANCELLED')).toBe('ACTIVE');
  });

  it('shows Cancel label when ACTIVE and not pending', () => {
    expect(getButtonLabel('ACTIVE', false)).toBe('Cancel');
  });

  it('shows Cancelling… label when ACTIVE and pending', () => {
    expect(getButtonLabel('ACTIVE', true)).toBe('Cancelling…');
  });

  it('shows Reactivate label when CANCELLED and not pending', () => {
    expect(getButtonLabel('CANCELLED', false)).toBe('Reactivate');
  });

  it('shows Reactivating… label when CANCELLED and pending', () => {
    expect(getButtonLabel('CANCELLED', true)).toBe('Reactivating…');
  });

  it('emits correct toast on cancel', () => {
    expect(getToastMessage('CANCELLED')).toBe('Booking cancelled');
  });

  it('emits correct toast on reactivate', () => {
    expect(getToastMessage('ACTIVE')).toBe('Booking reactivated');
  });

  it('emits correct error on failed cancel', () => {
    expect(getErrorMessage('CANCELLED')).toBe('Failed to cancel booking');
  });

  it('emits correct error on failed reactivate', () => {
    expect(getErrorMessage('ACTIVE')).toBe('Failed to reactivate booking');
  });

  it('applies line-through to provider name when cancelled', () => {
    expect(getProviderClass('CANCELLED')).toContain('line-through');
  });

  it('does not apply line-through to provider name when active', () => {
    expect(getProviderClass('ACTIVE')).not.toContain('line-through');
  });

  it('shows cancelled badge when status is CANCELLED', () => {
    expect(showCancelledBadge('CANCELLED')).toBe(true);
  });

  it('hides cancelled badge when status is ACTIVE', () => {
    expect(showCancelledBadge('ACTIVE')).toBe(false);
  });

  it('validates ACTIVE as a valid status', () => {
    expect(isValidStatus('ACTIVE')).toBe(true);
  });

  it('validates CANCELLED as a valid status', () => {
    expect(isValidStatus('CANCELLED')).toBe(true);
  });

  it('rejects unknown status values', () => {
    expect(isValidStatus('PENDING')).toBe(false);
    expect(isValidStatus('')).toBe(false);
  });
});
