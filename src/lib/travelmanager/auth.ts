import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { User } from '@supabase/supabase-js';
import prisma from '@/lib/prisma';
import { generateUniqueUsername } from '@/lib/travelmanager/username';

export type AuthResult =
  | { user: User; response: null }
  | { user: null; response: NextResponse };

/**
 * Ensure a Prisma User row exists for the authenticated Supabase user.
 * The OAuth callback (/auth/callback) upserts this row, but email+password
 * and native Bearer sessions never hit that route — so provision it here,
 * covering every sign-in method. Fast path: one indexed findUnique when the
 * row already exists (the common case), so we don't write on every request.
 */
async function ensureUserRow(user: User): Promise<void> {
  const existing = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true },
  });
  if (existing) return;

  const meta = user.user_metadata ?? {};
  const email = user.email ?? '';
  const username = await generateUniqueUsername(
    meta.full_name || email || 'user'
  );
  try {
    await prisma.user.create({
      data: {
        id: user.id,
        email,
        name: meta.full_name ?? '',
        avatarUrl: meta.avatar_url ?? null,
        username,
      },
    });
  } catch {
    // Swallow unique races (a concurrent request created it, or the email is
    // already linked to a different Supabase id). Auth still succeeds.
  }
}

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
        await ensureUserRow(user);
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

  await ensureUserRow(user);
  return { user, response: null };
}
