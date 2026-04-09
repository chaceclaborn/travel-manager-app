import { describe, it, expect } from 'vitest';
import { sanitizeObject } from '@/lib/sanitize';

const BOOKING_ALLOWED_FIELDS = [
  'tripId', 'type', 'provider', 'confirmationNum',
  'startDateTime', 'endDateTime', 'location', 'endLocation',
  'seat', 'notes', 'cancelled',
];

describe('booking cancelled field', () => {
  it('passes boolean true through sanitizeObject', () => {
    const input = { cancelled: true };
    const result = sanitizeObject(input, BOOKING_ALLOWED_FIELDS);
    expect(result).toHaveProperty('cancelled', true);
  });

  it('passes boolean false through sanitizeObject', () => {
    const input = { cancelled: false };
    const result = sanitizeObject(input, BOOKING_ALLOWED_FIELDS);
    expect(result).toHaveProperty('cancelled', false);
  });

  it('strips cancelled if not in allowed fields', () => {
    const restrictedFields = ['type', 'provider'];
    const input = { type: 'FLIGHT', provider: 'Delta', cancelled: true };
    const result = sanitizeObject(input, restrictedFields);
    expect(result).not.toHaveProperty('cancelled');
  });

  it('includes cancelled alongside other booking fields', () => {
    const input = {
      type: 'FLIGHT',
      provider: 'Delta Airlines',
      confirmationNum: 'ABC123',
      cancelled: true,
    };
    const result = sanitizeObject(input, BOOKING_ALLOWED_FIELDS);
    expect(result).toEqual({
      type: 'FLIGHT',
      provider: 'Delta Airlines',
      confirmationNum: 'ABC123',
      cancelled: true,
    });
  });

  it('does not include cancelled when absent from input', () => {
    const input = { type: 'HOTEL', provider: 'Hilton' };
    const result = sanitizeObject(input, BOOKING_ALLOWED_FIELDS);
    expect(result).not.toHaveProperty('cancelled');
  });

  it('validates that non-boolean cancelled should be rejected at API level', () => {
    // The sanitizeObject passes non-strings through unchanged,
    // so the API route must validate the type itself.
    const input = { cancelled: 'yes' };
    const result = sanitizeObject(input, BOOKING_ALLOWED_FIELDS);
    // sanitizeObject passes non-strings through — type check is the API's responsibility
    expect(typeof result.cancelled).toBe('string');
    // This is exactly why the API has: typeof sanitized.cancelled !== 'boolean'
    expect(typeof result.cancelled !== 'boolean').toBe(true);
  });

  it('preserves other fields when only cancelled changes', () => {
    const input = {
      provider: 'United Airlines',
      location: 'LAX',
      endLocation: 'JFK',
      cancelled: false,
    };
    const result = sanitizeObject(input, BOOKING_ALLOWED_FIELDS);
    expect(result.provider).toBe('United Airlines');
    expect(result.location).toBe('LAX');
    expect(result.endLocation).toBe('JFK');
    expect(result.cancelled).toBe(false);
  });
});
