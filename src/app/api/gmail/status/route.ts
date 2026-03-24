import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/travelmanager/auth';
import { rateLimit } from '@/lib/rate-limit';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const rateLimitResult = rateLimit(request, 'read');
    if (rateLimitResult) return rateLimitResult;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { gmailRefreshToken: true },
    });

    return NextResponse.json({ connected: !!dbUser?.gmailRefreshToken });
  } catch {
    return NextResponse.json({ connected: false });
  }
}
