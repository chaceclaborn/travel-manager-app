import { describe, it, expect } from 'vitest';
import { compareVersions, MIN_SUPPORTED_APP_VERSION, LATEST_APP_VERSION } from '@/lib/app-version';

describe('compareVersions', () => {
  it('orders plain versions', () => {
    expect(compareVersions('1.0', '1.0.1')).toBe(-1);
    expect(compareVersions('1.0.1', '1.0')).toBe(1);
    expect(compareVersions('2.0', '1.9.9')).toBe(1);
  });

  it('treats missing segments as zero', () => {
    expect(compareVersions('1.0', '1.0.0')).toBe(0);
    expect(compareVersions('1', '1.0.0')).toBe(0);
  });

  it('compares numerically, not lexically', () => {
    expect(compareVersions('1.10', '1.9')).toBe(1);
    expect(compareVersions('1.2', '1.10')).toBe(-1);
  });

  it('treats garbage segments as zero (fails toward "outdated")', () => {
    expect(compareVersions('garbage', '1.0')).toBe(-1);
    expect(compareVersions('1.x.2', '1.0.2')).toBe(0);
    expect(compareVersions('', '0')).toBe(0);
  });

  it('policy sanity: minVersion never exceeds latestVersion', () => {
    expect(compareVersions(MIN_SUPPORTED_APP_VERSION, LATEST_APP_VERSION)).toBeLessThanOrEqual(0);
  });
});
