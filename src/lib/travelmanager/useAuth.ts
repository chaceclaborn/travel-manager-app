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
  // Only true once the SERVER has told us the session is invalid. The layout
  // gates its redirect on this rather than on `!user`, so a failed network call
  // can never sign anyone out. See init() below.
  const [authKnownBad, setAuthKnownBad] = useState(false);

  useEffect(() => {
    if (!supabase?.auth) return;

    /**
     * Cold-launch auth, offline-tolerant.
     *
     * The previous version awaited `getUser()` — a NETWORK call — and pushed
     * whatever it returned into state. With no signal that call fails, `user`
     * stayed null, and the layout's redirect fired: opening the app in airplane
     * mode with a perfectly valid stored session dumped the user on the
     * marketing page. That is the moment a travel app is most needed.
     *
     * So: seed from `getSession()`, which reads the persisted JWT from local
     * storage with no network, and render immediately. Then revalidate against
     * the server in the background, and only clear the user when the server
     * actually says the token is bad — never on a transport failure.
     *
     * The tradeoff is deliberate: between launch and a successful revalidation
     * we trust a locally-stored JWT. That is what every offline-capable app
     * does, and the token still has to satisfy `requireAuth()` server-side
     * before any data is returned, so a stale local session buys nothing.
     */
    async function init() {
      // Declared outside the try so the catch below can tell "we have a stored
      // session to fall back on" from "we have nothing".
      let cached: User | null = null;
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        cached = sessionData?.session?.user ?? null;
        if (cached) {
          setUser(cached);
          setLoading(false);
        }

        const { data, error } = await supabase.auth.getUser();
        if (error) {
          // Distinguish "the server rejected this token" from "we couldn't
          // reach the server". Supabase surfaces the former with an HTTP
          // status; offline failures arrive as a fetch TypeError with none.
          const status = (error as { status?: number }).status;
          const definitivelyInvalid = status === 401 || status === 403;
          if (definitivelyInvalid || !cached) {
            // No stored session to fall back on means there is nothing to
            // restore even if this failure was only the network — the user
            // genuinely has no credential, so send them to the tour rather
            // than leaving them on a blank screen forever.
            setUser(null);
            setAuthKnownBad(true);
          }
          // Otherwise (offline, DNS, 5xx, timeout WITH a stored session) leave
          // the cached session in place — we simply don't know yet.
        } else {
          setUser((data as { user: User | null }).user);
          setAuthKnownBad(!(data as { user: User | null }).user);
        }
      } catch {
        // getSession/getUser threw outright (offline in the native shell does
        // this). Keep a seeded session; with nothing seeded, fall through to
        // the tour rather than rendering nothing.
        if (!cached) setAuthKnownBad(true);
      } finally {
        setLoading(false);
      }
    }
    init();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (event: string, session: { user: User; access_token?: string } | null) => {
        setUser(session?.user ?? null);
        // SIGNED_OUT is definitive — the SDK has cleared the session locally
        // (explicit sign-out, or a revoked/expired refresh token). Everything
        // else that carries a session means we are good again. Note this is a
        // LOCAL signal, so it stays correct offline.
        if (event === 'SIGNED_OUT') setAuthKnownBad(true);
        else if (session) setAuthKnownBad(false);
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

  return { user, loading, authKnownBad, signInWithGoogle, signInWithApple, signInWithEmail, signUpWithEmail, signOut };
}
