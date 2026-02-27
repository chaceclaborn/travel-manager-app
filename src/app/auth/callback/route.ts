import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import prisma from '@/lib/prisma';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(`${origin}/tour?error=session_expired`);
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      const reason = error.message?.toLowerCase().includes('expired')
        ? 'session_expired'
        : 'auth';
      return NextResponse.redirect(`${origin}/tour?error=${reason}`);
    }

    if (!data.user) {
      return NextResponse.redirect(`${origin}/tour?error=auth`);
    }

    const { user } = data;
    const meta = user.user_metadata;
    const email = user.email ?? '';

    const existing = await prisma.user.findUnique({ where: { email } });

    if (existing && existing.id !== user.id) {
      const tables = [
        'Trip', 'AuditLog', 'Vendor', 'Client', 'Expense',
        'Booking', 'ChecklistItem', 'TripNote', 'TravelDocument', 'TripAttachment',
      ] as const;

      await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `UPDATE "User" SET id = $1, name = $2, "avatarUrl" = $3, "updatedAt" = NOW() WHERE email = $4`,
          user.id, meta.full_name ?? '', meta.avatar_url ?? null, email
        );
        for (const table of tables) {
          await tx.$executeRawUnsafe(
            `UPDATE "${table}" SET "userId" = $1 WHERE "userId" = $2`,
            user.id, existing.id
          );
        }
      });
    } else {
      await prisma.user.upsert({
        where: { id: user.id },
        update: {
          email,
          name: meta.full_name ?? '',
          avatarUrl: meta.avatar_url ?? null,
        },
        create: {
          id: user.id,
          email,
          name: meta.full_name ?? '',
          avatarUrl: meta.avatar_url ?? null,
        },
      });
    }

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'sign_in',
        ipAddress:
          request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
          request.headers.get('x-real-ip') ??
          'unknown',
        userAgent: request.headers.get('user-agent') ?? 'unknown',
      },
    });

    return NextResponse.redirect(`${origin}/`);
  } catch (err) {
    const message = err instanceof Error ? err.message.toLowerCase() : '';
    if (message.includes('unique') || message.includes('duplicate') || message.includes('conflict')) {
      return NextResponse.redirect(`${origin}/tour?error=email_conflict`);
    }
    return NextResponse.redirect(`${origin}/tour?error=auth`);
  }
}
