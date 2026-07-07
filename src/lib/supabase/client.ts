'use client';

import { createBrowserClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { isNativePlatform } from '@/lib/mobile-auth';

let client: ReturnType<typeof createBrowserClient> | null = null;

export function createSupabaseBrowserClient() {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    // Return a stub client during build/SSG when env vars aren't available
    return null as unknown as ReturnType<typeof createBrowserClient>;
  }

  if (isNativePlatform()) {
    // NATIVE (Capacitor / iOS): the app is served from capacitor://localhost with
    // no server, so the cookie-based @supabase/ssr client cannot reliably persist
    // the session inside WKWebView. Symptom: after a successful sign-in the app
    // reloads to '/', the session is gone, and it bounces straight back to the
    // sign-in screen ("it just reloads and doesn't sign in"). Use the standard
    // supabase-js client with localStorage storage instead — that IS stable in the
    // native webview and survives the post-login navigation.
    //
    // setStoredToken/getStoredToken (mobile-auth.ts) still mirror the access token
    // into Capacitor Preferences for the native Bearer path in native-fetch.ts.
    client = createClient(url, key, {
      auth: {
        storage: window.localStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    }) as unknown as ReturnType<typeof createBrowserClient>;
    return client;
  }

  // WEB: unchanged — cookie-based client so the session syncs with the server
  // (middleware / server components / SSR).
  client = createBrowserClient(url, key);

  return client;
}
