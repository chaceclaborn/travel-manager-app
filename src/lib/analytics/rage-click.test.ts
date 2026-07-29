import { describe, it, expect } from 'vitest';
import {
  detectRageClick,
  RAGE_CLICK_COUNT,
  RAGE_WINDOW_MS,
  RAGE_RADIUS_PX,
  type ClickPoint,
} from './rage-click';

/**
 * The bar this has to clear is not "does it fire" — the retired heuristic fired
 * constantly, which is exactly why 76% of recorded analytics was noise. It is
 * "does it stay quiet during normal use". Most of these cases are negative.
 */

/** Feed a sequence through the detector the way the component does. */
function run(points: ClickPoint[]): number {
  let buffer: ClickPoint[] = [];
  let rages = 0;
  for (const p of points) {
    const r = detectRageClick(buffer, p);
    buffer = r.buffer;
    if (r.isRage) rages++;
  }
  return rages;
}

describe('detectRageClick — fires on genuine rage', () => {
  it('fires on 3 fast clicks in the same spot', () => {
    expect(run([
      { x: 100, y: 100, t: 0 },
      { x: 100, y: 100, t: 100 },
      { x: 100, y: 100, t: 200 },
    ])).toBe(1);
  });

  it('tolerates small finger jitter within the radius', () => {
    expect(run([
      { x: 100, y: 100, t: 0 },
      { x: 115, y: 108, t: 90 },
      { x: 92, y: 119, t: 180 },
    ])).toBe(1);
  });

  it('reports a long burst ONCE, not once per extra click', () => {
    // Eight rapid clicks: the buffer resets after the third, so the next burst
    // needs another three. Without the reset this would report six times.
    const pts = Array.from({ length: 8 }, (_, i) => ({ x: 50, y: 50, t: i * 50 }));
    expect(run(pts)).toBe(2);
  });
});

describe('detectRageClick — stays quiet during normal use', () => {
  it('ignores two fast clicks (a double-tap is not rage)', () => {
    expect(run([
      { x: 100, y: 100, t: 0 },
      { x: 100, y: 100, t: 80 },
    ])).toBe(0);
  });

  it('ignores three clicks spread beyond the time window', () => {
    expect(run([
      { x: 100, y: 100, t: 0 },
      { x: 100, y: 100, t: 600 },
      { x: 100, y: 100, t: 1200 },
    ])).toBe(0);
  });

  it('ignores a fast drag across the screen — this is the map-pan case', () => {
    // The old heuristic counted every one of these as frustration.
    expect(run([
      { x: 20, y: 300, t: 0 },
      { x: 120, y: 300, t: 60 },
      { x: 240, y: 300, t: 120 },
      { x: 360, y: 300, t: 180 },
    ])).toBe(0);
  });

  it('ignores fast taps on DIFFERENT controls (working down a checklist)', () => {
    expect(run([
      { x: 50, y: 100, t: 0 },
      { x: 50, y: 200, t: 120 },
      { x: 50, y: 300, t: 240 },
    ])).toBe(0);
  });

  it('ignores a slow drift that never clusters', () => {
    // Each step is inside the radius of its predecessor but not of the first —
    // the check is against the first point precisely to reject this.
    expect(run([
      { x: 0, y: 0, t: 0 },
      { x: 30, y: 0, t: 100 },
      { x: 60, y: 0, t: 200 },
      { x: 90, y: 0, t: 300 },
    ])).toBe(0);
  });
});

describe('detectRageClick — boundaries', () => {
  it('fires exactly at the radius, not beyond it', () => {
    const at = run([
      { x: 0, y: 0, t: 0 },
      { x: RAGE_RADIUS_PX, y: 0, t: 50 },
      { x: 0, y: 0, t: 100 },
    ]);
    const beyond = run([
      { x: 0, y: 0, t: 0 },
      { x: RAGE_RADIUS_PX + 1, y: 0, t: 50 },
      { x: 0, y: 0, t: 100 },
    ]);
    expect(at).toBe(1);
    expect(beyond).toBe(0);
  });

  it('drops clicks that fall out of the window as it slides', () => {
    expect(run([
      { x: 0, y: 0, t: 0 },
      { x: 0, y: 0, t: RAGE_WINDOW_MS + 10 },
      { x: 0, y: 0, t: RAGE_WINDOW_MS + 20 },
    ])).toBe(0);
  });

  it('needs exactly RAGE_CLICK_COUNT clicks', () => {
    const pts = Array.from({ length: RAGE_CLICK_COUNT - 1 }, (_, i) => ({ x: 5, y: 5, t: i * 10 }));
    expect(run(pts)).toBe(0);
  });

  it('never mutates the caller’s buffer', () => {
    const original: ClickPoint[] = [{ x: 1, y: 1, t: 0 }];
    const snapshot = [...original];
    detectRageClick(original, { x: 1, y: 1, t: 10 });
    expect(original).toEqual(snapshot);
  });
});
