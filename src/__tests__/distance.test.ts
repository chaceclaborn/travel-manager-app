import { describe, it, expect } from 'vitest';
import { haversineDistance, KM_TO_MILES } from '@/lib/distance';

// Well-known coordinates
const NYC = { lat: 40.7128, lng: -74.006 };
const LONDON = { lat: 51.5074, lng: -0.1278 };
const TOKYO = { lat: 35.6762, lng: 139.6503 };

describe('haversineDistance', () => {
  it('returns 0 for the same point', () => {
    expect(haversineDistance(NYC.lat, NYC.lng, NYC.lat, NYC.lng)).toBe(0);
  });

  it('calculates NYC to London (~5,570 km)', () => {
    const dist = haversineDistance(NYC.lat, NYC.lng, LONDON.lat, LONDON.lng);
    expect(dist).toBeGreaterThan(5500);
    expect(dist).toBeLessThan(5700);
  });

  it('calculates NYC to Tokyo (~10,850 km)', () => {
    const dist = haversineDistance(NYC.lat, NYC.lng, TOKYO.lat, TOKYO.lng);
    expect(dist).toBeGreaterThan(10500);
    expect(dist).toBeLessThan(11200);
  });

  it('calculates London to Tokyo (~9,560 km)', () => {
    const dist = haversineDistance(LONDON.lat, LONDON.lng, TOKYO.lat, TOKYO.lng);
    expect(dist).toBeGreaterThan(9400);
    expect(dist).toBeLessThan(9700);
  });

  it('is symmetric — A→B equals B→A', () => {
    const ab = haversineDistance(NYC.lat, NYC.lng, LONDON.lat, LONDON.lng);
    const ba = haversineDistance(LONDON.lat, LONDON.lng, NYC.lat, NYC.lng);
    expect(ab).toBe(ba);
  });

  it('returns a short distance for nearby points', () => {
    // ~0.01 degrees apart (roughly 1 km)
    const dist = haversineDistance(40.0, -74.0, 40.01, -74.0);
    expect(dist).toBeGreaterThan(0.5);
    expect(dist).toBeLessThan(2);
  });
});

describe('KM_TO_MILES', () => {
  it('has the correct conversion factor', () => {
    expect(KM_TO_MILES).toBeCloseTo(0.621371, 5);
  });

  it('converts a known distance correctly', () => {
    const km = 100;
    expect(km * KM_TO_MILES).toBeCloseTo(62.1371, 3);
  });
});
