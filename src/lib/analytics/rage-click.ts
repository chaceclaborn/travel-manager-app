/**
 * Rage-click detection.
 *
 * A rage click is the recognised signal for "this looks tappable and isn't" or
 * "this is stuck": several clicks in fast succession on effectively one spot.
 *
 * This replaced a heuristic that recorded frustration for EVERY click which
 * didn't land near an interactive element. That version made map drags, card
 * taps, text selection and modal-backdrop dismissals all read as frustration —
 * 2,371 of 3,115 recorded events, i.e. 76% of all analytics was instrumentation
 * noise being reported back as a defect count.
 *
 * Kept as a pure function, separate from the React component, so the thresholds
 * are testable without a DOM. The component owns only the buffer.
 */

export interface ClickPoint {
  x: number;
  y: number;
  /** Epoch milliseconds. */
  t: number;
}

/** Conventional thresholds (Hotjar/FullStory use ~3 clicks / 500ms / small radius). */
export const RAGE_CLICK_COUNT = 3;
export const RAGE_WINDOW_MS = 500;
export const RAGE_RADIUS_PX = 40;

export interface RageResult {
  /** The buffer to carry forward. Emptied after a burst so one burst reports once. */
  buffer: ClickPoint[];
  /** True when this click completes a rage burst. */
  isRage: boolean;
}

/**
 * Fold one click into the sliding window and report whether it completes a
 * burst. Callers keep `buffer` and pass it back on the next click.
 *
 * Deliberately considers clicks that DID hit a control: repeatedly stabbing a
 * button that isn't responding is the case most worth catching, and the old
 * heuristic missed it entirely.
 */
export function detectRageClick(recent: readonly ClickPoint[], click: ClickPoint): RageResult {
  // Drop anything outside the window before measuring.
  const buffer = recent.filter((c) => click.t - c.t < RAGE_WINDOW_MS);
  buffer.push(click);

  if (buffer.length < RAGE_CLICK_COUNT) return { buffer, isRage: false };

  // Every point must sit within the radius of the first, so a slow drift across
  // the screen doesn't accumulate into a false positive.
  const first = buffer[0];
  const clustered = buffer.every(
    (c) => Math.hypot(c.x - first.x, c.y - first.y) <= RAGE_RADIUS_PX
  );

  // Reset on a burst so a long stab-fest reports once, not once per extra click.
  return clustered ? { buffer: [], isRage: true } : { buffer, isRage: false };
}
