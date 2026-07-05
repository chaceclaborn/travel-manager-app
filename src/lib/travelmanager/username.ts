import prisma from '@/lib/prisma';

// Usernames: 3–20 chars, lowercase letters/digits/underscore, must start with
// a letter. Stored lowercase so uniqueness is effectively case-insensitive
// against the DB unique index.
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;
const USERNAME_RE = /^[a-z][a-z0-9_]{2,19}$/;

// Reserved handles we never hand out or allow (route names, impersonation).
const RESERVED = new Set([
  'admin', 'root', 'support', 'help', 'api', 'settings', 'trips', 'friends',
  'clients', 'vendors', 'bookings', 'meetings', 'analytics', 'map', 'me',
  'user', 'users', 'null', 'undefined', 'system',
]);

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Returns an error message if invalid, or null if the shape is acceptable. */
export function validateUsername(raw: string): string | null {
  const u = normalizeUsername(raw);
  if (u.length < USERNAME_MIN) return `Username must be at least ${USERNAME_MIN} characters`;
  if (u.length > USERNAME_MAX) return `Username must be at most ${USERNAME_MAX} characters`;
  if (!USERNAME_RE.test(u)) return 'Use letters, numbers, and underscores; start with a letter';
  if (RESERVED.has(u)) return 'That username is reserved';
  return null;
}

/** True if no other user holds this username (case-insensitive). */
export async function isUsernameAvailable(raw: string, excludeUserId?: string): Promise<boolean> {
  const u = normalizeUsername(raw);
  const existing = await prisma.user.findFirst({
    where: { username: u, ...(excludeUserId ? { NOT: { id: excludeUserId } } : {}) },
    select: { id: true },
  });
  return !existing;
}

/** Sanitize an arbitrary string (e.g. an email local-part) into a valid base. */
export function toUsernameBase(seed: string): string {
  let base = normalizeUsername(seed).replace(/[^a-z0-9_]/g, '');
  if (!/^[a-z]/.test(base)) base = `u${base}`;
  base = base.slice(0, USERNAME_MAX);
  if (base.length < USERNAME_MIN) base = (base + 'user').slice(0, USERNAME_MAX);
  return base;
}

/**
 * Generate a unique username from a seed (email or name), probing the DB for
 * collisions and appending a numeric suffix until free. Used at signup and
 * for backfilling accounts created before usernames existed.
 */
export async function generateUniqueUsername(seed: string): Promise<string> {
  const base = toUsernameBase(seed);
  if (await isUsernameAvailable(base)) return base;
  for (let n = 2; n < 10000; n++) {
    const suffix = String(n);
    const candidate = base.slice(0, USERNAME_MAX - suffix.length) + suffix;
    if (await isUsernameAvailable(candidate)) return candidate;
  }
  // Extremely unlikely fallback — a random tail.
  return base.slice(0, USERNAME_MAX - 5) + Math.floor(1000 + (Date.now() % 9000));
}
