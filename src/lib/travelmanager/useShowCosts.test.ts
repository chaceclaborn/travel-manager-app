import { describe, it, expect } from 'vitest';
import { isCostsShown } from './useShowCosts';

describe('isCostsShown', () => {
  it('defaults to shown when unset (null)', () => {
    expect(isCostsShown(null)).toBe(true);
  });

  it("is shown for '1'", () => {
    expect(isCostsShown('1')).toBe(true);
  });

  it("is hidden only for the literal '0'", () => {
    expect(isCostsShown('0')).toBe(false);
  });

  it('treats unrecognized/legacy values as shown (fail open)', () => {
    expect(isCostsShown('')).toBe(true);
    expect(isCostsShown('true')).toBe(true);
    expect(isCostsShown('yes')).toBe(true);
  });
});
