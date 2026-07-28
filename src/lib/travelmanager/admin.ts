import { requireAuth } from './auth';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function requireAdmin() {
  const { user, response } = await requireAuth();
  if (!user) return { user: null, response };

  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail || user.email?.toLowerCase() !== adminEmail.toLowerCase()) {
    return {
      user: null,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }

  return { user, response: null };
}

/**
 * Accounts that are ours, not real customers: the owner's two logins plus the
 * account Apple's reviewers sign in with. They dominate every admin metric
 * (they're the most frequent visitors by far), so admin analytics filters them
 * out. Override with INTERNAL_ACCOUNT_EMAILS (comma-separated) to change the
 * list without a deploy.
 */
const DEFAULT_INTERNAL_EMAILS = [
  'chaceclaborn@gmail.com',
  'chacexcorp@gmail.com',
  'appreview@travels-manager.com',
];

export function internalEmails(): string[] {
  const configured = process.env.INTERNAL_ACCOUNT_EMAILS;
  const list = configured
    ? configured.split(',').map((e) => e.trim()).filter(Boolean)
    : DEFAULT_INTERNAL_EMAILS;
  return list.map((e) => e.toLowerCase());
}

/**
 * User ids for the internal accounts. Resolved by email so it keeps working if
 * an account is deleted and re-created with a new uuid.
 */
export async function internalUserIds(): Promise<string[]> {
  const emails = internalEmails();
  if (emails.length === 0) return [];
  const rows = await prisma.user.findMany({
    where: { email: { in: emails, mode: 'insensitive' } },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}
