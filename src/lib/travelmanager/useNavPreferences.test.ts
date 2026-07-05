import { describe, it, expect } from 'vitest';
import { sanitizeHiddenKeys, NAV_ITEMS, TOGGLEABLE_NAV_ITEMS } from './useNavPreferences';

describe('sanitizeHiddenKeys', () => {
  it('keeps valid toggleable keys', () => {
    const result = sanitizeHiddenKeys(['clients', 'vendors']);
    expect([...result].sort()).toEqual(['clients', 'vendors']);
  });

  it('drops the non-toggleable dashboard key even if persisted', () => {
    const result = sanitizeHiddenKeys(['dashboard', 'clients']);
    expect(result.has('dashboard')).toBe(false);
    expect(result.has('clients')).toBe(true);
  });

  it('drops unknown / stale keys from removed features', () => {
    const result = sanitizeHiddenKeys(['clients', 'some-old-feature', 'invoices']);
    expect([...result]).toEqual(['clients']);
  });

  it('returns an empty set for malformed input', () => {
    expect(sanitizeHiddenKeys(null).size).toBe(0);
    expect(sanitizeHiddenKeys(undefined).size).toBe(0);
    expect(sanitizeHiddenKeys('clients').size).toBe(0);
    expect(sanitizeHiddenKeys({ clients: true }).size).toBe(0);
    expect(sanitizeHiddenKeys([1, 2, null, {}]).size).toBe(0);
  });

  it('accepts every toggleable key as hideable', () => {
    const all = TOGGLEABLE_NAV_ITEMS.map((i) => i.key);
    const result = sanitizeHiddenKeys(all);
    expect(result.size).toBe(all.length);
  });
});

describe('NAV_ITEMS invariants', () => {
  it('has exactly one non-toggleable anchor (dashboard)', () => {
    const nonToggleable = NAV_ITEMS.filter((i) => !i.toggleable);
    expect(nonToggleable.map((i) => i.key)).toEqual(['dashboard']);
  });

  it('has unique keys', () => {
    const keys = NAV_ITEMS.map((i) => i.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
