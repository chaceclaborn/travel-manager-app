'use client';

import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { setStoredToken, clearStoredToken, isNativePlatform } from '@/lib/mobile-auth';
import type { User } from '@supabase/supabase-js';

export function useAuth() {
  const supabase = createSupabaseBrowserClient();
  const [user, setUser] = useState<User | null>(null);
  // Derive initial loading from whether supabase is available — avoids
  // a synchronous setLoading(false) inside the effect body (React 19 lint).
  const [loading, setLoading] = useState(() => Boolean(supabase?.auth));

  useEffect(() => {
    if (!supabase?.auth) return;

    async function init() {
      const { data } = await supabase.auth.getUser();
      setUser((data as { user: User | null }).user);
      setLoading(false);
    }
    init();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (event: string, session: { user: User; access_token?: string } | null) => {
        setUser(session?.user ?? null);
        // Keep the NATIVE Bearer token fresh. The Supabase JS SDK silently
        // auto-rotates the in-webview access token (roughly hourly). Without
        // re-persisting it, getStoredToken() stays frozen at the original
        // sign-in JWT; once that expires the rewritten /api requests in
        // native-fetch.ts send an expired token and requireAuth() returns 401
        // with no cookie fallback, breaking all native data loading until the
        // user signs out and back in. Persist every refreshed/new token, and
        // clear it on sign-out. Web is untouched (isNativePlatform() is false).
        if (!isNativePlatform()) return;
        if (event === 'SIGNED_OUT') {
          void clearStoredToken();
        } else if (session?.access_token) {
          void setStoredToken(session.access_token);
        }
      }
    );

    return () => (listener as { subscription: { unsubscribe: () => void } }).subscription.unsubscribe();
  }, [supabase]);

  /**
   * Google / Apple sign-in. On WEB this is the redirect OAuth flow through
   * /auth/callback. In the NATIVE shell that route doesn't exist (static
   * export), so we run the platform-native sheet and exchange the ID token
   * directly — see native-oauth.ts. Returns an error message to display, or
   * null when there is nothing to show (success navigates away; a dismissed
   * native sheet is not an error).
   */
  async function signInWithGoogle(): Promise<string | null> {
    if (!supabase?.auth) {
      console.error('Supabase client not initialized — check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
      return 'Sign-in is unavailable right now. Please try again later.';
    }
    if (isNativePlatform()) {
      const { nativeOAuthSignIn } = await import('@/lib/native-oauth');
      return nativeOAuthSignIn(supabase, 'google');
    }
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/auth/callback',
      },
    });
    return null;
  }

  async function signInWithApple(): Promise<string | null> {
    if (!supabase?.auth) {
      console.error('Supabase client not initialized — check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
      return 'Sign-in is unavailable right now. Please try again later.';
    }
    if (isNativePlatform()) {
      const { nativeOAuthSignIn } = await import('@/lib/native-oauth');
      return nativeOAuthSignIn(supabase, 'apple');
    }
    await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        redirectTo: window.location.origin + '/auth/callback',
      },
    });
    return null;
  }

  /**
   * Email + password sign-in. This is the reliable auth path *inside the
   * native (Capacitor) shell* — the OAuth buttons redirect through
   * `/auth/callback`, a route that only exists on the Vercel web deploy and
   * is not part of the static export bundled in the iOS app. It is also the
   * demo path we hand to App Review (Apple's reviewer signs in with the demo
   * credentials rather than fighting a third-party OAuth challenge).
   *
   * On success we persist the access token via `setStoredToken` so the
   * native Bearer-auth path (`apiFetch`) can call the Vercel API cross-origin,
   * where cookies don't round-trip.
   *
   * Requires the Email provider (password auth) enabled in Supabase.
   * Returns an error string on failure, or null on success.
   */
  async function signInWithEmail(email: string, password: string): Promise<string | null> {
    if (!supabase?.auth) {
      return 'Sign-in is unavailable right now. Please try again later.';
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return error.message || 'Invalid email or password.';
    }
    const token = data.session?.access_token;
    if (token) {
      await setStoredToken(token);
    }
    window.location.href = '/';
    return null;
  }

  /**
   * Email + password account creation. Mirrors signInWithEmail's contract but
   * also reports whether Supabase wants the address confirmed first (when
   * "Confirm email" is enabled, signUp returns a user with NO session — the
   * caller should tell the user to check their inbox, then sign in).
   *
   * The confirmation link must land on the WEB origin (the native shell can't
   * serve it), so emailRedirectTo is pinned to production, not
   * window.location.origin (which is capacitor://localhost natively).
   */
  async function signUpWithEmail(
    email: string,
    password: string
  ): Promise<{ error: string | null; needsConfirmation: boolean }> {
    if (!supabase?.auth) {
      return { error: 'Sign-up is unavailable right now. Please try again later.', needsConfirmation: false };
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: 'https://www.travels-manager.com/tour?confirmed=1' },
    });
    if (error) {
      return { error: error.message || 'Could not create the account.', needsConfirmation: false };
    }
    // Existing-email probe: Supabase (with confirmations on) answers an
    // already-registered address with a user object that has EMPTY identities
    // rather than an error, to avoid leaking who has an account. Surface a
    // helpful message instead of a misleading "check your email".
    if (data.user && !data.session && (data.user.identities?.length ?? 0) === 0) {
      return { error: 'An account with this email already exists. Try signing in instead.', needsConfirmation: false };
    }
    if (data.session) {
      // Confirmations disabled — signed in immediately; same path as sign-in.
      if (data.session.access_token) {
        await setStoredToken(data.session.access_token);
      }
      window.location.href = '/';
      return { error: null, needsConfirmation: false };
    }
    return { error: null, needsConfirmation: true };
  }

  async function signOut() {
    await clearStoredToken();
    // scope: 'local' clears the session without the network round-trip that
    // the default global sign-out makes. In the Capacitor shell that call can
    // hang or throw and block the redirect below, so the button "does
    // nothing"; the stored Bearer token is already cleared and the server
    // token expires on its own. try/catch guarantees we still navigate away.
    try {
      await supabase?.auth?.signOut({ scope: 'local' });
    } catch {
      /* best-effort — still redirect to the sign-in screen */
    }
    // Native uses a trailing slash: the iOS static export (trailingSlash:true)
    // stores this route as /tour/index.html, and a bare `/tour` hard
    // navigation doesn't resolve to a file in the webview. Web has a server
    // that serves /tour directly, so leave it unchanged there.
    window.location.href = isNativePlatform() ? '/tour/' : '/tour';
  }

  return { user, loading, signInWithGoogle, signInWithApple, signInWithEmail, signUpWithEmail, signOut };
}
