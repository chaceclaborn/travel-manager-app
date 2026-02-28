import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import prisma from '@/lib/prisma';
import { rateLimit } from '@/lib/rate-limit';

export async function GET(request: NextRequest) {
  const rateLimitResult = rateLimit(request, 'auth');
  if (rateLimitResult) return rateLimitResult;

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
      await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`UPDATE "User" SET id = ${user.id}, name = ${meta.full_name ?? ''}, "avatarUrl" = ${meta.avatar_url ?? null}, "updatedAt" = NOW() WHERE email = ${email}`;
        await tx.$executeRaw`UPDATE "Trip" SET "userId" = ${user.id} WHERE "userId" = ${existing.id}`;
        await tx.$executeRaw`UPDATE "AuditLog" SET "userId" = ${user.id} WHERE "userId" = ${existing.id}`;
        await tx.$executeRaw`UPDATE "Vendor" SET "userId" = ${user.id} WHERE "userId" = ${existing.id}`;
        await tx.$executeRaw`UPDATE "Client" SET "userId" = ${user.id} WHERE "userId" = ${existing.id}`;
        await tx.$executeRaw`UPDATE "Expense" SET "userId" = ${user.id} WHERE "userId" = ${existing.id}`;
        await tx.$executeRaw`UPDATE "Booking" SET "userId" = ${user.id} WHERE "userId" = ${existing.id}`;
        await tx.$executeRaw`UPDATE "ChecklistItem" SET "userId" = ${user.id} WHERE "userId" = ${existing.id}`;
        await tx.$executeRaw`UPDATE "TripNote" SET "userId" = ${user.id} WHERE "userId" = ${existing.id}`;
        await tx.$executeRaw`UPDATE "TripAttachment" SET "userId" = ${user.id} WHERE "userId" = ${existing.id}`;
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
