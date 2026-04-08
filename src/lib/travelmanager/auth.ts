import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { User } from '@supabase/supabase-js';

export type AuthResult =
  | { user: User; response: null }
  | { user: null; response: NextResponse };

export async function requireAuth(): Promise<AuthResult> {
  // Strategy 1: Bearer token (iOS / Capacitor / any non-cookie client)
  // Checked first so mobile clients never fall through to the cookie path.
  const headerStore = await headers();
  const authHeader =
    headerStore.get('authorization') || headerStore.get('Authorization');

  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) {
      const supabase = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        }
      );
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser(token);

      if (!error && user) {
        return { user, response: null };
      }

      // Bearer header was present but invalid — don't silently fall back
      // to cookies (that would hide auth bugs on mobile).
      return {
        user: null,
        response: NextResponse.json(
          { error: 'Invalid bearer token' },
          { status: 401 }
        ),
      };
    }
  }

  // Strategy 2: Cookie session (existing web flow — unchanged behavior)
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      user: null,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  return { user, response: null };
}
