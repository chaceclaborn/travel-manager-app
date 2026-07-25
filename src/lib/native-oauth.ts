/**
 * Native (Capacitor) OAuth sign-in for the iOS shell.
 *
 * The web app signs in with `supabase.auth.signInWithOAuth`, which redirects
 * through `/auth/callback` — a route that only exists on the Vercel deploy and
 * is NOT part of the static export bundled into the iOS app, so that flow can
 * never complete natively. Instead we use the platform-native sheets via
 * @capgo/capacitor-social-login and hand the resulting ID token straight to
 * `supabase.auth.signInWithIdToken` — no redirect, no web callback.
 *
 * Requirements (config, not code):
 *  - Google: an iOS OAuth client ID (Google Cloud Console → Credentials) whose
 *    bundle ID is com.chaceclaborn.travelmanager; the SAME client ID must be in
 *    Supabase → Auth → Providers → Google → "Authorized Client IDs".
 *  - Apple: "Sign in with Apple" capability on the App ID + entitlement, and
 *    com.chaceclaborn.travelmanager listed in Supabase → Providers → Apple →
 *    "Authorized Client IDs" (native tokens have the bundle ID as audience).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { setStoredToken } from './mobile-auth';

// Google Cloud Console → APIs & Services → Credentials → "Travel Manager iOS".
// This is a public identifier (it ships in the app bundle), not a secret.
export const GOOGLE_IOS_CLIENT_ID =
  '615013387724-kq9f2unerj5o02d6osjanna2vlhllgrr.apps.googleusercontent.com';

let initialized = false;

async function socialLogin() {
  const { SocialLogin } = await import('@capgo/capacitor-social-login');
  if (!initialized) {
    await SocialLogin.initialize({
      google: { iOSClientId: GOOGLE_IOS_CLIENT_ID },
      apple: {},
    });
    initialized = true;
  }
  return SocialLogin;
}

function randomNonce(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Resolve `promise`, but fail fast if the auth sheet closes without a result.
 *
 * The native sheet (ASWebAuthenticationSession) hides this page while it is
 * open, so `visibilitychange` is a reliable "the user is done interacting"
 * signal that costs no plugin. While the sheet is up we wait indefinitely —
 * the person may be hunting for a password. Once it closes, a result should be
 * milliseconds away; if none arrives within the grace period the callback was
 * dropped and we say so rather than spinning.
 *
 * A long backstop still applies for the case where the sheet never presents at
 * all (then the page never hides, so the visibility path never arms).
 */
function withSheetWatchdog<T>(promise: Promise<T>, graceMs = 8000, backstopMs = 5 * 60 * 1000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    let sawHidden = false;
    let graceTimer: ReturnType<typeof setTimeout> | undefined;

    const cleanup = () => {
      settled = true;
      clearTimeout(graceTimer);
      clearTimeout(backstopTimer);
      document.removeEventListener('visibilitychange', onVisibility);
    };

    function onVisibility() {
      if (settled) return;
      if (document.visibilityState === 'hidden') {
        sawHidden = true;
        clearTimeout(graceTimer);
        return;
      }
      // Visible again after having been hidden => the sheet just closed.
      if (sawHidden) {
        graceTimer = setTimeout(() => {
          if (settled) return;
          cleanup();
          reject(new Error('Sign-in closed without returning a result. Please try again.'));
        }, graceMs);
      }
    }

    const backstopTimer = setTimeout(() => {
      if (settled) return;
      cleanup();
      reject(new Error('Google sign-in timed out. Please try again.'));
    }, backstopMs);

    document.addEventListener('visibilitychange', onVisibility);

    promise.then(
      (value) => { if (!settled) { cleanup(); resolve(value); } },
      (err) => { if (!settled) { cleanup(); reject(err); } },
    );
  });
}

/**
 * Runs the native OAuth sheet for `provider` and creates a Supabase session
 * from the returned ID token. On success persists the Bearer token (native
 * API auth — see mobile-auth.ts) and hard-navigates to the dashboard.
 *
 * Returns an error message to show the user, or null when there is nothing to
 * show (success — we navigate away — or the user simply dismissed the sheet).
 */
export async function nativeOAuthSignIn(
  supabase: SupabaseClient,
  provider: 'google' | 'apple'
): Promise<string | null> {
  let idToken: string | undefined;
  // Both providers need a nonce. The native sheet receives the SHA-256 of the
  // raw nonce (embedded verbatim as the id_token's `nonce` claim); Supabase then
  // re-hashes the RAW nonce we pass to signInWithIdToken and compares. Google's
  // interactive flow ALWAYS mints a token with a nonce claim, so if we passed
  // none, Supabase would reject with "Passed nonce and nonce in id_token should
  // either both exist or both not exist" — the exact failure new users hit.
  const rawNonce = randomNonce();
  const hashed = await sha256Hex(rawNonce);

  try {
    const SocialLogin = await socialLogin();
    if (provider === 'apple') {
      const res = await SocialLogin.login({
        provider: 'apple',
        options: { nonce: hashed, scopes: ['email', 'name'] },
      });
      const result = res.result as { idToken?: string; identityToken?: string };
      idToken = result?.idToken ?? result?.identityToken;
    } else {
      // Force the interactive path. The plugin otherwise silently restores a
      // cached session whose refreshed token has NO nonce — which would flip
      // the mismatch the other way (we pass a nonce, token has none). Clearing
      // first guarantees the token carries OUR hashed nonce.
      try {
        await SocialLogin.logout({ provider: 'google' });
      } catch {
        // No previous session to clear — fine.
      }
      // Guard against a native flow that never settles (build-6/7 postmortem:
      // dead buttons). A plain timeout is the wrong instrument here, and both
      // ways of setting it are wrong:
      //   - short (30s) fails a valid sign-in while the person is still
      //     typing a password or doing 2FA;
      //   - long (5min) turns a dropped callback into a five-minute hang.
      // What actually distinguishes the two is whether the sheet is still
      // open. While it is, the page is hidden and the user is working; once it
      // closes the page becomes visible again and a result should arrive
      // almost immediately. So the watchdog only starts on that transition.
      //
      // Observed on the simulator 2026-07-25: the sheet completed (the log
      // shows SafariViewService matching our callback scheme) and the plugin
      // promise never resolved. This surfaces that in seconds instead of
      // hanging, and says so plainly.
      const res = (await withSheetWatchdog(
        SocialLogin.login({
          provider: 'google',
          options: { nonce: hashed, scopes: ['email', 'profile'] },
        }),
      )) as Awaited<ReturnType<typeof SocialLogin.login>>;
      idToken = (res.result as { idToken?: string })?.idToken;
    }
  } catch (e) {
    // A dismissed sheet is not an error — but anything else must be VISIBLE.
    // (Build 6 shipped without the native plugin linked; the old blanket
    // `return null` here turned that into silent dead buttons.)
    const msg = e instanceof Error ? e.message : String(e);
    if (/cancel|dismiss/i.test(msg)) return null;
    console.error(`[native-oauth] ${provider} sign-in failed:`, msg);
    // Surface the real reason. The old copy always said "Couldn't start …",
    // which sent us hunting for a plugin/linking fault when the sheet had in
    // fact started fine and the *result* never came back.
    return `${provider === 'apple' ? 'Apple' : 'Google'} sign-in failed: ${msg}`;
  }

  if (!idToken) return null; // dismissed / no token — nothing to show

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider,
    token: idToken,
    nonce: rawNonce,
  });
  if (error) {
    return error.message || 'Sign-in failed. Please try again.';
  }
  const token = data.session?.access_token;
  if (token) {
    await setStoredToken(token);
  }
  window.location.href = '/';
  return null;
}
