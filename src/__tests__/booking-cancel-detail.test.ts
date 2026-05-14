import { describe, it, expect } from 'vitest';

// Mirrors the inline logic added to src/app/(app)/bookings/[id]/page.tsx

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

function getButtonLabel(status: BookingStatus): string {
  return status === 'CANCELLED' ? 'Reactivate' : 'Cancel';
}

function getButtonColorClass(status: BookingStatus): string {
  return status === 'CANCELLED'
    ? 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50'
    : 'text-amber-600 hover:text-amber-700 hover:bg-amber-50';
}

function getProviderNameClass(status: BookingStatus): string {
  return status === 'CANCELLED' ? 'text-slate-400 line-through' : 'text-slate-800';
}

function shouldShowCancelledBadge(status: BookingStatus): boolean {
  return status === 'CANCELLED';
}

describe('booking detail cancel — status toggle', () => {
  it('toggling ACTIVE produces CANCELLED', () => {
    expect(getNextStatus('ACTIVE')).toBe('CANCELLED');
  });

  it('toggling CANCELLED produces ACTIVE', () => {
    expect(getNextStatus('CANCELLED')).toBe('ACTIVE');
  });
});

describe('booking detail cancel — toast messages', () => {
  it('shows "Booking cancelled" when next status is CANCELLED', () => {
    expect(getCancelToastMessage('CANCELLED')).toBe('Booking cancelled');
  });

  it('shows "Booking reactivated" when next status is ACTIVE', () => {
    expect(getCancelToastMessage('ACTIVE')).toBe('Booking reactivated');
  });
});

describe('booking detail cancel — error messages', () => {
  it('shows cancel error when next status is CANCELLED', () => {
    expect(getCancelErrorMessage('CANCELLED')).toBe('Failed to cancel booking');
  });

  it('shows reactivate error when next status is ACTIVE', () => {
    expect(getCancelErrorMessage('ACTIVE')).toBe('Failed to reactivate booking');
  });
});

describe('booking detail cancel — button label', () => {
  it('shows "Cancel" when booking is active', () => {
    expect(getButtonLabel('ACTIVE')).toBe('Cancel');
  });

  it('shows "Reactivate" when booking is cancelled', () => {
    expect(getButtonLabel('CANCELLED')).toBe('Reactivate');
  });
});

describe('booking detail cancel — button colour', () => {
  it('uses amber colour for the Cancel button', () => {
    expect(getButtonColorClass('ACTIVE')).toContain('text-amber-600');
  });

  it('uses emerald colour for the Reactivate button', () => {
    expect(getButtonColorClass('CANCELLED')).toContain('text-emerald-600');
  });
});

describe('booking detail cancel — provider name styling', () => {
  it('applies line-through and slate-400 when cancelled', () => {
    const cls = getProviderNameClass('CANCELLED');
    expect(cls).toContain('line-through');
    expect(cls).toContain('text-slate-400');
  });

  it('uses normal slate-800 weight when active', () => {
    const cls = getProviderNameClass('ACTIVE');
    expect(cls).toContain('text-slate-800');
    expect(cls).not.toContain('line-through');
  });
});

describe('booking detail cancel — cancelled badge visibility', () => {
  it('shows badge when booking is cancelled', () => {
    expect(shouldShowCancelledBadge('CANCELLED')).toBe(true);
  });

  it('hides badge when booking is active', () => {
    expect(shouldShowCancelledBadge('ACTIVE')).toBe(false);
  });
});
