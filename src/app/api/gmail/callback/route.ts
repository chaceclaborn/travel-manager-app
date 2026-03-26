import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/travelmanager/auth';
import { exchangeCodeForTokens } from '@/lib/travelmanager/gmail';
import { rateLimit } from '@/lib/rate-limit';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const rateLimitResult = rateLimit(request, 'write');
  if (rateLimitResult) return rateLimitResult;

  try {
    const { user, response } = await requireAuth();
    if (!user) return response;

    const code = request.nextUrl.searchParams.get('code');
    if (!code) {
      return NextResponse.redirect(new URL('/settings?gmail=error', request.url));
    }

    const tokens = await exchangeCodeForTokens(code);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        gmailAccessToken: tokens.access_token || null,
        gmailRefreshToken: tokens.refresh_token || null,
        gmailTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      },
    });

    return NextResponse.redirect(new URL('/settings?gmail=connected', request.url));
  } catch {
    return NextResponse.redirect(new URL('/settings?gmail=error', request.url));
  }
}
