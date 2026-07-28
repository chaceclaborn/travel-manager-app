'use client';

import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { setStoredToken, clearStoredToken, isNativePlatform } from '@/lib/mobile-auth';
import type { User } from '@supabase/supabase-js';

/**
 * Did the SERVER tell us this token is no good? Only 401/403 count. Everything
 * else — status 0 (offline / DNS / TLS), 5xx, timeouts — means "we don't know",
 * and must never sign anyone out.
 */
export function isDefinitivelyInvalid(error: unknown): boolean {
  const status = (error as { status?: number } | null | undefined)?.status;
  return status === 401 || status === 403;
}

/**
 * Is there a credential on this device, even if we couldn't use it?
 *
 * The subtle half is `sessionError`. getSession() is not purely local: within
 * 90s of expiry auth-js refreshes the token over the network first. Offline
 * that fails and getSession returns { session: null, error } WITHOUT clearing
 * storage and WITHOUT emitting SIGNED_OUT. So a null session plus an error
 * means "signed in but unreachable", while a null session with no error means
 * genuinely signed out. Conflating the two is what sent an offline traveller
 * to the marketing page.
 */
export function hasStoredCredential(cachedUser: unknown, sessionError: unknown): boolean {
  return Boolean(cachedUser) || Boolean(sessionError);
}

/**
 * Last-resort read of the persisted Supabase session, straight out of storage.
 *
 * Only used when getSession() reported an error, which means a credential
 * exists but could not be refreshed (see init()). Without this the app renders
 * nothing at all offline once the access token has aged past ~1 hour: we
 * correctly decline to redirect, but `user` is null and the layout returns null.
 *
 * Deliberately tolerant — every failure path returns null rather than throwing,
 * because this runs on the cold-launch critical path. It reads both shapes the
 * two clients use: localStorage on native (supabase-js) and the possibly-chunked,
 * possibly base64-prefixed cookie on web (@supabase/ssr).
 */
function readPersistedUser(): User | null {
  try {
    if (typeof window === 'undefined') return null;
    const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!projectUrl) return null;
    const ref = new URL(projectUrl).hostname.split('.')[0];
    const key = `sb-${ref}-auth-token`;

    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(key);
    } catch {
      /* localStorage can throw in private mode — fall through to cookies */
    }

    if (!raw && typeof document !== 'undefined') {
      const jar = document.cookie ? document.cookie.split('; ') : [];
      const readCookie = (name: string): string | null => {
        const hit = jar.find((c) => c.startsWith(`${name}=`));
        return hit ? decodeURIComponent(hit.slice(name.length + 1)) : null;
      };
      // @supabase/ssr splits values over ~3KB into `<key>.0`, `<key>.1`, …
      const whole = readCookie(key);
      if (whole) {
        raw = whole;
      } else {
        const chunks: string[] = [];
        for (let i = 0; ; i++) {
          const chunk = readCookie(`${key}.${i}`);
          if (chunk === null) break;
          chunks.push(chunk);
        }
        raw = chunks.length > 0 ? chunks.join('') : null;
      }
    }

    if (!raw) return null;
    if (raw.startsWith('base64-')) raw = atob(raw.slice('base64-'.length));

    const parsed = JSON.parse(raw);
    const candidate = parsed?.user ?? parsed?.currentSession?.user ?? parsed?.session?.user;
    return candidate && typeof candidate.id === 'string' ? (candidate as User) : null;
  } catch {
    return null;
  }
}

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
    if (!supabase?.auth) {
      // No client at all — the build is missing NEXT_PUBLIC_SUPABASE_URL /
      // ANON_KEY, so nothing can ever authenticate. Declare auth bad so the
      // layout sends the user to the tour instead of rendering an empty shell
      // forever. `loading` is already false here (it is derived from the same
      // condition), so without this the screen just stays blank with no
      // redirect and no error — which is exactly what a misconfigured build
      // looked like on the Simulator.
      setAuthKnownBad(true);
      return;
    }

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
      // Declared outside the try so the catch below can tell "there is a stored
      // credential to fall back on" from "we have nothing".
      let credentialExists = false;
      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        let cached = sessionData?.session?.user ?? null;

        // getSession() is NOT purely local. If the access token is within 90s
        // of expiring, auth-js refreshes it first — a NETWORK call. Offline
        // that fails with AuthRetryableFetchError and getSession returns
        // { session: null, error }, while deliberately LEAVING the session in
        // storage and emitting no SIGNED_OUT. Since access tokens live ~1 hour,
        // any offline launch after the app has been closed that long lands here.
        //
        // So "no session returned" does NOT mean "not signed in" — the error is
        // the discriminator. A genuinely signed-out client returns
        // { session: null, error: null }; an unrefreshable stored session
        // returns { session: null, error: <retryable> }.
        credentialExists = hasStoredCredential(cached, sessionError);

        // Recover the identity straight from storage so the app can render
        // offline instead of showing an empty shell.
        if (!cached && sessionError) cached = readPersistedUser();

        if (cached) {
          setUser(cached);
          setLoading(false);
        }

        const { data, error } = await supabase.auth.getUser();
        if (error) {
          if (isDefinitivelyInvalid(error) || !credentialExists) {
            // Either the server rejected the token, or there is no stored
            // credential at all — nothing to restore even if this failure was
            // only the network. Send them to the tour rather than leaving a
            // blank screen forever.
            setUser(null);
            setAuthKnownBad(true);
          }
          // Otherwise (offline, DNS, 5xx, timeout, WITH a credential) keep what
          // we seeded — we simply don't know yet, and guessing signs people out.
        } else {
          setUser((data as { user: User | null }).user);
          setAuthKnownBad(!(data as { user: User | null }).user);
        }
      } catch {
        // getSession/getUser threw outright. Keep whatever we seeded; with no
        // credential at all, fall through to the tour rather than render nothing.
        if (!credentialExists) setAuthKnownBad(true);
      } finally {
        setLoading(false);
      }
    }
    init();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (event: string, session: { user: User; access_token?: string } | null) => {
        // Only SIGNED_OUT clears the user. It is definitive and LOCAL — the SDK
        // has already dropped the session (explicit sign-out, or a revoked
        // refresh token) — so it stays correct offline.
        //
        // Critically, this must NOT be `setUser(session?.user ?? null)`: when
        // auth-js cannot refresh an expired token offline it emits
        // INITIAL_SESSION with a NULL session, which would wipe the identity
        // init() just recovered from storage and blank the screen. A null
        // session on any event other than SIGNED_OUT means "unknown", not
        // "signed out", so leave state untouched.
        if (event === 'SIGNED_OUT') {
          setUser(null);
          setAuthKnownBad(true);
        } else if (session) {
          setUser(session.user);
          setAuthKnownBad(false);
        }
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
