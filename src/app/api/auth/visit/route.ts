import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/travelmanager/auth';
import { rateLimit } from '@/lib/rate-limit';
import prisma from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const rateLimited = rateLimit(request, 'write');
    if (rateLimited) return rateLimited;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const twentyHoursAgo = new Date(Date.now() - 20 * 60 * 60 * 1000);

    const existing = await prisma.auditLog.findFirst({
      where: {
        userId: user.id,
        action: 'daily_visit',
        createdAt: { gte: twentyHoursAgo },
      },
      select: { id: true },
    });

    if (!existing) {
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'daily_visit',
          ipAddress:
            request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
            request.headers.get('x-real-ip') ??
            null,
          userAgent: request.headers.get('user-agent') ?? null,
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
