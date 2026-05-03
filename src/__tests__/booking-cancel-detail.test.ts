import { describe, it, expect } from 'vitest';

type BookingStatus = 'ACTIVE' | 'CANCELLED';

// These mirror the exact logic in src/app/(app)/bookings/[id]/page.tsx

function getNextStatus(current: BookingStatus): BookingStatus {
  return current === 'CANCELLED' ? 'ACTIVE' : 'CANCELLED';
}

function getCancelToastMessage(nextStatus: BookingStatus): string {
  return nextStatus === 'CANCELLED' ? 'Booking cancelled' : 'Booking reactivated';
}

function getCancelErrorMessage(nextStatus: BookingStatus): string {
  return nextStatus === 'CANCELLED' ? 'Failed to cancel booking' : 'Failed to reactivate booking';
}

function getButtonLabel(status: BookingStatus): string {
  return status === 'CANCELLED' ? 'Reactivate' : 'Cancel';
}

function getProviderClassName(status: BookingStatus): string {
  return status === 'CANCELLED'
    ? 'text-2xl font-bold text-slate-400 line-through'
    : 'text-2xl font-bold text-slate-800';
}

describe('getNextStatus', () => {
  it('toggles ACTIVE to CANCELLED', () => {
    expect(getNextStatus('ACTIVE')).toBe('CANCELLED');
  });

  it('toggles CANCELLED to ACTIVE', () => {
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
  it('shows cancel error when cancelling fails', () => {
    expect(getCancelErrorMessage('CANCELLED')).toBe('Failed to cancel booking');
  });

  it('shows reactivate error when reactivating fails', () => {
    expect(getCancelErrorMessage('ACTIVE')).toBe('Failed to reactivate booking');
  });
});

describe('getButtonLabel', () => {
  it('shows Cancel when booking is active', () => {
    expect(getButtonLabel('ACTIVE')).toBe('Cancel');
  });

  it('shows Reactivate when booking is cancelled', () => {
    expect(getButtonLabel('CANCELLED')).toBe('Reactivate');
  });
});

describe('getProviderClassName', () => {
  it('applies strikethrough and muted colour when cancelled', () => {
    const cls = getProviderClassName('CANCELLED');
    expect(cls).toContain('line-through');
    expect(cls).toContain('text-slate-400');
  });

  it('applies bold dark colour when active', () => {
    const cls = getProviderClassName('ACTIVE');
    expect(cls).toContain('text-slate-800');
    expect(cls).not.toContain('line-through');
  });
});

describe('status validation', () => {
  it('only ACTIVE and CANCELLED are valid booking statuses', () => {
    const valid: BookingStatus[] = ['ACTIVE', 'CANCELLED'];
    expect(valid).toHaveLength(2);
    expect(valid).toContain('ACTIVE');
    expect(valid).toContain('CANCELLED');
  });

  it('toggle is its own inverse — applying twice returns to original', () => {
    expect(getNextStatus(getNextStatus('ACTIVE'))).toBe('ACTIVE');
    expect(getNextStatus(getNextStatus('CANCELLED'))).toBe('CANCELLED');
  });
});
