/**
 * App version policy + comparison. Shared by the /api/app-config route
 * (server) and the native update gate (client), so keep this dependency-free.
 *
 * Versions are dotted numerics ("1.0.1"). Comparison is segment-wise numeric
 * with missing segments treated as 0, so "1.0" === "1.0.0" and "1.0.1" > "1.0".
 * Unparseable versions compare as 0.0.0 (oldest) — fail toward prompting an
 * update rather than silently passing garbage.
 */

/**
 * The oldest iOS binary that is still fully compatible with the live API.
 * Raise ONLY after an expand-contract "contract" step ships, and only after
 * latestVersion has been ahead of it for a comfortable window — raising this
 * hard-blocks older binaries behind an App Store update screen.
 */
export const MIN_SUPPORTED_APP_VERSION = '1.0';

/**
 * The newest version live on the App Store. Drives the soft "update
 * available" banner. Update when a release is approved (not merely submitted).
 */
export const LATEST_APP_VERSION = '1.0.2';

export const IOS_APP_STORE_URL = 'https://apps.apple.com/app/id6787768170';

/** -1 if a < b, 0 if equal, 1 if a > b. */
export function compareVersions(a: string, b: string): number {
  const parse = (v: string): number[] =>
    v
      .trim()
      .split('.')
      .map((seg) => {
        const n = parseInt(seg, 10);
        return Number.isFinite(n) && n >= 0 ? n : 0;
      });
  const pa = parse(a);
  const pb = parse(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da < db) return -1;
    if (da > db) return 1;
  }
  return 0;
}
