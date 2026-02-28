import { requireAuth } from './auth';
import { NextResponse } from 'next/server';

const ADMIN_EMAIL = 'chaceclaborn@gmail.com';

export async function requireAdmin() {
  const { user, response } = await requireAuth();
  if (!user) return { user: null, response };

  if (user.email !== ADMIN_EMAIL) {
    return {
      user: null,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }

  return { user, response: null };
}
