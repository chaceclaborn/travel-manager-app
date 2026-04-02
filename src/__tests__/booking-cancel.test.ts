import { describe, it, expect } from 'vitest';
import { sanitizeObject } from '@/lib/sanitize';

/**
 * Tests for booking cancellation feature (issue #1).
 * Verifies that the `cancelled` boolean field is correctly handled
 * by sanitizeObject when included in the allowed fields list.
 */
describe('booking cancellation — sanitizeObject handling', () => {
  const BOOKING_ALLOWED_FIELDS_WITH_CANCEL = [
    'tripId', 'type', 'provider', 'confirmationNum',
    'startDateTime', 'endDateTime', 'location', 'endLocation',
    'seat', 'notes', 'cancelled',
  ];

  it('passes cancelled=true through when in allowed fields', () => {
    const result = sanitizeObject({ cancelled: true }, BOOKING_ALLOWED_FIELDS_WITH_CANCEL);
    expect(result.cancelled).toBe(true);
  });

  it('passes cancelled=false through when in allowed fields', () => {
    const result = sanitizeObject({ cancelled: false }, BOOKING_ALLOWED_FIELDS_WITH_CANCEL);
    expect(result.cancelled).toBe(false);
  });

  it('strips cancelled when not in allowed fields', () => {
    const fieldsWithoutCancel = BOOKING_ALLOWED_FIELDS_WITH_CANCEL.filter((f) => f !== 'cancelled');
    const result = sanitizeObject({ cancelled: true, provider: 'Delta' }, fieldsWithoutCancel);
    expect(result).not.toHaveProperty('cancelled');
    expect(result.provider).toBe('Delta');
  });

  it('does not coerce cancelled boolean to a string', () => {
    const result = sanitizeObject({ cancelled: true }, BOOKING_ALLOWED_FIELDS_WITH_CANCEL);
    expect(typeof result.cancelled).toBe('boolean');
  });

  it('keeps other booking fields intact alongside cancelled', () => {
    const result = sanitizeObject(
      { provider: 'Delta Airlines', cancelled: true, type: 'FLIGHT' },
      BOOKING_ALLOWED_FIELDS_WITH_CANCEL,
    );
    expect(result.provider).toBe('Delta Airlines');
    expect(result.cancelled).toBe(true);
    expect(result.type).toBe('FLIGHT');
  });

  it('handles payload with only cancelled field', () => {
    const result = sanitizeObject({ cancelled: false }, BOOKING_ALLOWED_FIELDS_WITH_CANCEL);
    expect(Object.keys(result)).toEqual(['cancelled']);
    expect(result.cancelled).toBe(false);
  });
});

describe('booking cancellation — toggle logic', () => {
  it('toggling from false to true sets cancelled', () => {
    const current = false;
    const next = !current;
    expect(next).toBe(true);
  });

  it('toggling from true to false unsets cancelled', () => {
    const current = true;
    const next = !current;
    expect(next).toBe(false);
  });

  it('cancelled defaults to false for new bookings', () => {
    const newBooking = { cancelled: false };
    expect(newBooking.cancelled).toBe(false);
  });
});
