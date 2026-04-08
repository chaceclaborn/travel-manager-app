/**
 * Mobile / Capacitor auth helpers.
 *
 * - On iOS / Capacitor native runtime, the session token is stored in
 *   @capacitor/preferences (which is Keychain-backed on iOS).
 * - On the web, this file is a no-op for storage in the normal case —
 *   the Supabase cookie flow is still the primary auth path in the browser.
 *   localStorage is used only as a fallback so this module degrades safely.
 *
 * @capacitor/preferences is loaded via dynamic import so the package is
 * effectively optional — if it isn't installed yet (or we're in a web
 * build), the import simply fails and we fall back to web storage.
 */

// Minimal local shape for the subset of @capacitor/preferences we use.
// We avoid importing the real types here so this file type-checks even
// before the package is installed (another agent handles the Capacitor
// install step). At runtime the plugin's real API matches this shape.
interface PreferencesLike {
  get(options: { key: string }): Promise<{ value: string | null }>;
  set(options: { key: string; value: string }): Promise<void>;
  remove(options: { key: string }): Promise<void>;
}

let preferencesPlugin: PreferencesLike | null = null;
let preferencesLoadAttempted = false;

async function getPreferences(): Promise<PreferencesLike | null> {
  if (typeof window === 'undefined') return null;
  if (preferencesPlugin) return preferencesPlugin;
  if (preferencesLoadAttempted) return null;
  preferencesLoadAttempted = true;

  if (!isNativePlatform()) return null;

  try {
    const mod = await import('@capacitor/preferences');
    preferencesPlugin = mod.Preferences as PreferencesLike;
    return preferencesPlugin;
  } catch {
    // @capacitor/preferences not installed (yet) — gracefully degrade.
    return null;
  }
}

const SESSION_KEY = 'tm_session_token';

export function isNativePlatform(): boolean {
  if (typeof window === 'undefined') return false;
  // Capacitor injects a global at runtime; it's untyped here so we access
  // it defensively.
  const cap = (window as unknown as {
    Capacitor?: { isNativePlatform?: () => boolean };
  }).Capacitor;
  return !!cap?.isNativePlatform?.();
}

export async function getStoredToken(): Promise<string | null> {
  const prefs = await getPreferences();
  if (prefs) {
    const { value } = await prefs.get({ key: SESSION_KEY });
    return value || null;
  }
  if (typeof localStorage !== 'undefined') {
    return localStorage.getItem(SESSION_KEY);
  }
  return null;
}

export async function setStoredToken(token: string): Promise<void> {
  const prefs = await getPreferences();
  if (prefs) {
    await prefs.set({ key: SESSION_KEY, value: token });
    return;
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(SESSION_KEY, token);
  }
}

export async function clearStoredToken(): Promise<void> {
  const prefs = await getPreferences();
  if (prefs) {
    await prefs.remove({ key: SESSION_KEY });
    return;
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(SESSION_KEY);
  }
}

/**
 * Fetch wrapper that injects `Authorization: Bearer <token>` on native
 * (Capacitor) runtimes. On web it is a pass-through to `fetch()` so the
 * existing cookie-based auth flow continues to work unchanged.
 *
 * This is the PREFERRED fetch for any feature code that needs to run in
 * both web (cookie auth) and mobile (Bearer auth) contexts. Existing
 * `fetch()` call sites do not need to be migrated immediately — they will
 * keep working on web via cookies. Migrate to `apiFetch` incrementally as
 * features are touched.
 */
export async function apiFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (isNativePlatform()) {
    const token = await getStoredToken();
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }
  return fetch(input, { ...init, headers });
}
