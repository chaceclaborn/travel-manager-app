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

  async function signInWithGoogle() {
    if (!supabase?.auth) {
      console.error('Supabase client not initialized — check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
      return;
    }
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/auth/callback',
      },
    });
  }

  async function signInWithApple() {
    if (!supabase?.auth) {
      console.error('Supabase client not initialized — check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
      return;
    }
    await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        redirectTo: window.location.origin + '/auth/callback',
      },
    });
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

  return { user, loading, signInWithGoogle, signInWithApple, signInWithEmail, signOut };
}
