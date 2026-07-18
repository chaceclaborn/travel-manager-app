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
  let rawNonce: string | undefined;

  try {
    const SocialLogin = await socialLogin();
    if (provider === 'apple') {
      // Apple requires the SHA-256 of the nonce in the request; Supabase then
      // verifies the RAW nonce against the hash embedded in the identity token.
      rawNonce = randomNonce();
      const hashed = await sha256Hex(rawNonce);
      const res = await SocialLogin.login({
        provider: 'apple',
        options: { nonce: hashed, scopes: ['email', 'name'] },
      });
      const result = res.result as { idToken?: string; identityToken?: string };
      idToken = result?.idToken ?? result?.identityToken;
    } else {
      const res = await SocialLogin.login({
        provider: 'google',
        options: { scopes: ['email', 'profile'] },
      });
      idToken = (res.result as { idToken?: string })?.idToken;
    }
  } catch {
    // The native sheet throws when the user cancels — not an error to surface.
    return null;
  }

  if (!idToken) return null; // dismissed / no token — nothing to show

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider,
    token: idToken,
    ...(rawNonce ? { nonce: rawNonce } : {}),
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
