/**
 * Mobile / Capacitor auth helpers.
 *
 * The native session (Bearer) token is stored in localStorage. localStorage is
 * synchronous and reliable inside the iOS WKWebView (capacitor://localhost) and
 * persists across launches; it is also where the Supabase session already lives.
 *
 * We intentionally do NOT use @capacitor/preferences (Keychain) here: its async
 * get() could hang inside the webview, and because the native fetch interceptor
 * awaits getStoredToken() before EVERY /api request, one hung read stalled all
 * native data loading (the app sat on loading skeletons forever).
 */

const SESSION_KEY = 'tm_session_token';

export function isNativePlatform(): boolean {
  if (typeof window === 'undefined') return false;
  // Capacitor injects a global at runtime; it's untyped here so we access it
  // defensively.
  const cap = (window as unknown as {
    Capacitor?: { isNativePlatform?: () => boolean };
  }).Capacitor;
  return !!cap?.isNativePlatform?.();
}

export async function getStoredToken(): Promise<string | null> {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(SESSION_KEY);
    }
  } catch {
    // ignore storage access errors
  }
  return null;
}

export async function setStoredToken(token: string): Promise<void> {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SESSION_KEY, token);
    }
  } catch {
    // ignore storage access errors
  }
}

export async function clearStoredToken(): Promise<void> {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(SESSION_KEY);
    }
  } catch {
    // ignore storage access errors
  }
}

/**
 * Fetch wrapper that injects `Authorization: Bearer <token>` on native
 * (Capacitor) runtimes. On web it is a pass-through to `fetch()` so the existing
 * cookie-based auth flow continues to work unchanged. (Most native /api calls
 * are also covered by the global interceptor in native-fetch.ts; this remains
 * for the few call sites that import it directly, e.g. PushRegister.)
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
