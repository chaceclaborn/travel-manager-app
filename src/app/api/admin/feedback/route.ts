import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/travelmanager/admin';
import { rateLimit } from '@/lib/rate-limit';
import { validateEnum, validateUUID } from '@/lib/sanitize';
import prisma from '@/lib/prisma';
import type { FeedbackStatus } from '@/lib/generated/prisma';

const VALID_STATUSES = ['NEW', 'REVIEWED', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED'] as const;
const VALID_CATEGORIES = ['BUG', 'FEATURE', 'UX', 'OTHER'] as const;

export async function GET(request: NextRequest) {
  try {
    const rateLimited = rateLimit(request, 'sensitive');
    if (rateLimited) return rateLimited;

    const { user, response } = await requireAdmin();
    if (!user) return response;

    const statusParam = request.nextUrl.searchParams.get('status');
    if (statusParam && !validateEnum(statusParam, VALID_STATUSES)) {
      return NextResponse.json({ error: 'Invalid status filter' }, { status: 400 });
    }
    const status = statusParam as FeedbackStatus | null;
    const limit = Math.min(Number(request.nextUrl.searchParams.get('limit')) || 50, 100);

    const feedback = await prisma.feedback.findMany({
      where: status ? { status } : undefined,
      include: { user: { select: { email: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return NextResponse.json({ feedback });
  } catch (error) {
    console.error('Admin feedback error:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to fetch feedback' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const rateLimited = rateLimit(request, 'sensitive');
    if (rateLimited) return rateLimited;

    const { user, response } = await requireAdmin();
    if (!user) return response;

    const { id, status, category } = await request.json();
    if (!id || typeof id !== 'string' || !validateUUID(id)) {
      return NextResponse.json({ error: 'Valid feedback id required' }, { status: 400 });
    }
    if (status && !validateEnum(status, VALID_STATUSES)) {
      return NextResponse.json({ error: 'Invalid feedback status' }, { status: 400 });
    }
    if (category && !validateEnum(category, VALID_CATEGORIES)) {
      return NextResponse.json({ error: 'Invalid feedback category' }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    if (status) data.status = status;
    if (category) data.category = category;
    if (status === 'RESOLVED') data.resolvedAt = new Date();

    const updated = await prisma.feedback.update({
      where: { id },
      data,
    });

    // Audit-log the admin mutation. Admin endpoints touch other users' data,
    // so every state change must be reconstructible from the AuditLog table
    // (who, when, what changed). Wrapped to never block the response.
    try {
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'admin_feedback_update',
          ipAddress:
            request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
            request.headers.get('x-real-ip') ??
            null,
          userAgent: request.headers.get('user-agent') ?? null,
          metadata: { feedbackId: id, status: status ?? null, category: category ?? null },
        },
      });
    } catch {
      // Best-effort logging — never break admin actions on logging failure.
    }

    return NextResponse.json({ feedback: updated });
  } catch (error) {
    console.error('Admin feedback update error:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to update feedback' }, { status: 500 });
  }
}
