import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import prisma from '@/lib/prisma';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(`${origin}/tour?error=auth`);
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error || !data.user) {
      return NextResponse.redirect(`${origin}/tour?error=auth`);
    }

    const { user } = data;
    const meta = user.user_metadata;

    await prisma.user.upsert({
      where: { id: user.id },
      update: {
        email: user.email ?? '',
        name: meta.full_name ?? '',
        avatarUrl: meta.avatar_url ?? null,
      },
      create: {
        id: user.id,
        email: user.email ?? '',
        name: meta.full_name ?? '',
        avatarUrl: meta.avatar_url ?? null,
      },
    });

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
  } catch {
    return NextResponse.redirect(`${origin}/tour?error=auth`);
  }
}
