import { requireAuth } from './auth';
import { NextResponse } from 'next/server';

export async function requireAdmin() {
  const { user, response } = await requireAuth();
  if (!user) return { user: null, response };

  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail || user.email !== adminEmail) {
    return {
      user: null,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }

  return { user, response: null };
}
