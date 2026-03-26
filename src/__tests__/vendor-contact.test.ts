import { describe, it, expect } from 'vitest';
import { sanitizeObject } from '@/lib/sanitize';

const VENDOR_FIELDS = ['name', 'contactName', 'category', 'email', 'phone', 'address', 'city', 'state', 'website', 'notes'];

describe('vendor contactName field', () => {
  it('includes contactName in sanitized vendor data', () => {
    const input = { name: 'Acme Travel', contactName: 'Jane Doe', category: 'SUPPLIER' };
    const result = sanitizeObject(input, VENDOR_FIELDS);
    expect(result).toHaveProperty('contactName', 'Jane Doe');
  });

  it('sanitizes HTML from contactName', () => {
    const input = { name: 'Acme', contactName: '<b>Jane</b> Doe' };
    const result = sanitizeObject(input, VENDOR_FIELDS);
    expect(result.contactName).toBe('Jane Doe');
  });

  it('allows empty contactName (not in input)', () => {
    const input = { name: 'Acme Travel', category: 'HOTEL' };
    const result = sanitizeObject(input, VENDOR_FIELDS);
    expect(result).not.toHaveProperty('contactName');
  });

  it('strips contactName if not in allowed fields', () => {
    const restrictedFields = ['name', 'category'];
    const input = { name: 'Acme', contactName: 'Jane Doe' };
    const result = sanitizeObject(input, restrictedFields);
    expect(result).not.toHaveProperty('contactName');
  });

  it('preserves all other vendor fields alongside contactName', () => {
    const input = {
      name: 'Global Hotels',
      contactName: 'John Smith',
      category: 'HOTEL',
      email: 'john@globalhotels.com',
      phone: '555-0123',
      city: 'New York',
      state: 'NY',
    };
    const result = sanitizeObject(input, VENDOR_FIELDS);
    expect(result).toEqual({
      name: 'Global Hotels',
      contactName: 'John Smith',
      category: 'HOTEL',
      email: 'john@globalhotels.com',
      phone: '555-0123',
      city: 'New York',
      state: 'NY',
    });
  });

  it('handles contactName with special characters', () => {
    const input = { name: 'Test', contactName: "María O'Brien-López" };
    const result = sanitizeObject(input, VENDOR_FIELDS);
    expect(result.contactName).toBe("María O'Brien-López");
  });
});
