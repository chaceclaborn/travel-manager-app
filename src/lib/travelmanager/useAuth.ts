'use client';

import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
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
      (_event: string, session: { user: User } | null) => {
        setUser(session?.user ?? null);
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

  async function signOut() {
    if (!supabase?.auth) return;
    await supabase.auth.signOut();
    window.location.href = '/tour';
  }

  return { user, loading, signInWithGoogle, signInWithApple, signOut };
}
