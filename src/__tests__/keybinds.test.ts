import { describe, it, expect } from 'vitest';
import { sanitizeKeybinds, findConflict, KEYBIND_DEFS } from '@/lib/travelmanager/keybinds';

describe('sanitizeKeybinds', () => {
  it('returns empty overrides for malformed input', () => {
    expect(sanitizeKeybinds(null)).toEqual({});
    expect(sanitizeKeybinds('junk')).toEqual({});
    expect(sanitizeKeybinds([1, 2])).toEqual({});
  });

  it('keeps valid single-character overrides', () => {
    expect(sanitizeKeybinds({ search: 'p' })).toEqual({ search: 'p' });
    expect(sanitizeKeybinds({ 'go-trips': '1' })).toEqual({ 'go-trips': '1' });
  });

  it('drops invalid keys and unknown actions', () => {
    expect(sanitizeKeybinds({ search: 'F1' })).toEqual({});
    expect(sanitizeKeybinds({ search: '' })).toEqual({});
    expect(sanitizeKeybinds({ 'not-an-action': 'p' })).toEqual({});
  });

  it('drops an override that collides with another action of the same kind', () => {
    // 'go-trips' default is t; overriding go-bookings to t must be rejected.
    expect(sanitizeKeybinds({ 'go-bookings': 't' })).toEqual({});
  });

  it('allows the same letter across kinds (mod vs chord)', () => {
    // search is mod+K; a chord can also use k.
    expect(sanitizeKeybinds({ 'go-trips': 'k' })).toEqual({ 'go-trips': 'k' });
  });

  it('does not store overrides equal to the default', () => {
    expect(sanitizeKeybinds({ search: 'k' })).toEqual({});
  });
});

describe('findConflict', () => {
  const defaults = Object.fromEntries(KEYBIND_DEFS.map((d) => [d.action, d.defaultKey]));

  it('finds a chord conflict', () => {
    const hit = findConflict(defaults, 'chord', 't', 'go-bookings');
    expect(hit?.action).toBe('go-trips');
  });

  it('ignores the action being rebound and other kinds', () => {
    expect(findConflict(defaults, 'chord', 't', 'go-trips')).toBeNull();
    expect(findConflict(defaults, 'mod', 't', 'search')).toBeNull();
  });
});
