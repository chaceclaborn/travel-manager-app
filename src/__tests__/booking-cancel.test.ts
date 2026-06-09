import { describe, it, expect } from 'vitest';

type BookingStatus = 'ACTIVE' | 'CANCELLED';

function getNextStatus(current: BookingStatus): BookingStatus {
  return current === 'CANCELLED' ? 'ACTIVE' : 'CANCELLED';
}

function getCancelButtonLabel(status: BookingStatus): string {
  return status === 'CANCELLED' ? 'Reactivate booking' : 'Mark as cancelled';
}

function buildCancelPayload(id: string, nextStatus: BookingStatus) {
  return {
    url: `/api/bookings/${id}`,
    method: 'PUT',
    body: { status: nextStatus },
  };
}

function applyStatusUpdate(
  bookings: Array<{ id: string; status: BookingStatus }>,
  id: string,
  nextStatus: BookingStatus
) {
  return bookings.map((b) => (b.id === id ? { ...b, status: nextStatus } : b));
}

describe('booking cancel status toggle', () => {
  it('toggles ACTIVE to CANCELLED', () => {
    expect(getNextStatus('ACTIVE')).toBe('CANCELLED');
  });

  it('toggles CANCELLED to ACTIVE', () => {
    expect(getNextStatus('CANCELLED')).toBe('ACTIVE');
  });

  it('only valid statuses are ACTIVE and CANCELLED', () => {
    const valid: BookingStatus[] = ['ACTIVE', 'CANCELLED'];
    expect(valid).toContain(getNextStatus('ACTIVE'));
    expect(valid).toContain(getNextStatus('CANCELLED'));
  });
});

describe('cancel button label', () => {
  it('shows "Mark as cancelled" for active bookings', () => {
    expect(getCancelButtonLabel('ACTIVE')).toBe('Mark as cancelled');
  });

  it('shows "Reactivate booking" for cancelled bookings', () => {
    expect(getCancelButtonLabel('CANCELLED')).toBe('Reactivate booking');
  });
});

describe('cancel API payload', () => {
  it('builds correct PUT payload to cancel', () => {
    const payload = buildCancelPayload('booking-123', 'CANCELLED');
    expect(payload.url).toBe('/api/bookings/booking-123');
    expect(payload.method).toBe('PUT');
    expect(payload.body).toEqual({ status: 'CANCELLED' });
  });

  it('builds correct PUT payload to reactivate', () => {
    const payload = buildCancelPayload('booking-456', 'ACTIVE');
    expect(payload.url).toBe('/api/bookings/booking-456');
    expect(payload.method).toBe('PUT');
    expect(payload.body).toEqual({ status: 'ACTIVE' });
  });

  it('uses the given booking id in the URL', () => {
    const id = 'cmnhjqthn000404k05g6dgg8g';
    const payload = buildCancelPayload(id, 'CANCELLED');
    expect(payload.url).toContain(id);
  });
});

describe('optimistic status update', () => {
  const bookings = [
    { id: 'a', status: 'ACTIVE' as BookingStatus },
    { id: 'b', status: 'ACTIVE' as BookingStatus },
    { id: 'c', status: 'CANCELLED' as BookingStatus },
  ];

  it('updates only the target booking', () => {
    const result = applyStatusUpdate(bookings, 'a', 'CANCELLED');
    expect(result.find((b) => b.id === 'a')?.status).toBe('CANCELLED');
    expect(result.find((b) => b.id === 'b')?.status).toBe('ACTIVE');
    expect(result.find((b) => b.id === 'c')?.status).toBe('CANCELLED');
  });

  it('reactivates a cancelled booking', () => {
    const result = applyStatusUpdate(bookings, 'c', 'ACTIVE');
    expect(result.find((b) => b.id === 'c')?.status).toBe('ACTIVE');
  });

  it('leaves other bookings unchanged', () => {
    const result = applyStatusUpdate(bookings, 'b', 'CANCELLED');
    expect(result.find((b) => b.id === 'a')?.status).toBe('ACTIVE');
    expect(result.find((b) => b.id === 'c')?.status).toBe('CANCELLED');
  });

  it('returns a new array (does not mutate)', () => {
    const result = applyStatusUpdate(bookings, 'a', 'CANCELLED');
    expect(result).not.toBe(bookings);
    expect(bookings[0].status).toBe('ACTIVE');
  });

  it('handles an empty bookings list', () => {
    const result = applyStatusUpdate([], 'a', 'CANCELLED');
    expect(result).toEqual([]);
  });

  it('handles id not found (no change)', () => {
    const result = applyStatusUpdate(bookings, 'z', 'CANCELLED');
    expect(result.every((b) => b.status === bookings.find((o) => o.id === b.id)?.status)).toBe(true);
  });
});
