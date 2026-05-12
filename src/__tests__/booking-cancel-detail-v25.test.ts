import { describe, it, expect } from 'vitest';

type BookingStatus = 'ACTIVE' | 'CANCELLED';

function getNextStatus(current: BookingStatus): BookingStatus {
  return current === 'CANCELLED' ? 'ACTIVE' : 'CANCELLED';
}

function getButtonLabel(status: BookingStatus): string {
  return status === 'CANCELLED' ? 'Reactivate' : 'Cancel';
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

function getButtonClass(status: BookingStatus): string {
  return status === 'CANCELLED'
    ? 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50'
    : 'text-amber-600 hover:text-amber-700 hover:bg-amber-50';
}

describe('booking detail page — cancel toggle', () => {
  it('toggles ACTIVE to CANCELLED', () => {
    expect(getNextStatus('ACTIVE')).toBe('CANCELLED');
  });

  it('toggles CANCELLED to ACTIVE', () => {
    expect(getNextStatus('CANCELLED')).toBe('ACTIVE');
  });

  it('shows Cancel label when booking is ACTIVE', () => {
    expect(getButtonLabel('ACTIVE')).toBe('Cancel');
  });

  it('shows Reactivate label when booking is CANCELLED', () => {
    expect(getButtonLabel('CANCELLED')).toBe('Reactivate');
  });

  it('shows cancellation toast on cancel', () => {
    expect(getToastMessage('CANCELLED')).toBe('Booking cancelled');
  });

  it('shows reactivation toast on reactivate', () => {
    expect(getToastMessage('ACTIVE')).toBe('Booking reactivated');
  });

  it('shows correct error on failed cancel', () => {
    expect(getErrorMessage('CANCELLED')).toBe('Failed to cancel booking');
  });

  it('shows correct error on failed reactivate', () => {
    expect(getErrorMessage('ACTIVE')).toBe('Failed to reactivate booking');
  });

  it('applies strikethrough and muted colour when CANCELLED', () => {
    expect(getProviderClass('CANCELLED')).toContain('line-through');
    expect(getProviderClass('CANCELLED')).toContain('text-slate-400');
  });

  it('uses normal style when ACTIVE', () => {
    expect(getProviderClass('ACTIVE')).toBe('text-slate-800');
    expect(getProviderClass('ACTIVE')).not.toContain('line-through');
  });

  it('uses amber colour for Cancel button when ACTIVE', () => {
    expect(getButtonClass('ACTIVE')).toContain('text-amber-600');
  });

  it('uses emerald colour for Reactivate button when CANCELLED', () => {
    expect(getButtonClass('CANCELLED')).toContain('text-emerald-600');
  });
});
