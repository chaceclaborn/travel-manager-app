import { NextRequest, NextResponse } from 'next/server';
import { updateExpense, deleteExpense } from '@/lib/travelmanager/expenses';
import { requireAuth } from '@/lib/travelmanager/auth';
import { requireTripAccess, TripAccessError } from '@/lib/travelmanager/trip-access';
import { rateLimit } from '@/lib/rate-limit';
import prisma from '@/lib/prisma';
import { sanitizeObject, validateUUID, validateDateString, validateEnum, EXPENSE_CATEGORY_VALUES } from '@/lib/sanitize';

/**
 * The expense carries the tripId; the trip carries the permission. Reading the
 * row first is the only way these flat, non-trip-scoped endpoints can reach the
 * chokepoint at all — and the UI sends every expense edit here, so skipping it
 * would make this the bypass around /api/trips/[id]/expenses.
 */
async function tripIdForExpense(id: string): Promise<string | null> {
  const expense = await prisma.expense.findUnique({ where: { id }, select: { tripId: true } });
  return expense?.tripId ?? null;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const rateLimited = rateLimit(request, 'read');
    if (rateLimited) return rateLimited;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id } = await params;
    if (!validateUUID(id)) {
      return NextResponse.json({ error: 'Invalid expense ID' }, { status: 400 });
    }
    const expense = await prisma.expense.findUnique({ where: { id } });

    if (!expense) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    await requireTripAccess(expense.tripId, user.id, 'view');

    return NextResponse.json(expense);
  } catch (error) {
    if (error instanceof TripAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error fetching expense:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to fetch expense' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const rateLimited = rateLimit(request, 'write');
    if (rateLimited) return rateLimited;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id } = await params;
    if (!validateUUID(id)) {
      return NextResponse.json({ error: 'Invalid expense ID' }, { status: 400 });
    }

    const tripId = await tripIdForExpense(id);
    if (!tripId) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }
    await requireTripAccess(tripId, user.id, 'edit');

    const body = await request.json();
    const sanitized = sanitizeObject(body, ['amount', 'currency', 'category', 'description', 'date', 'receiptPath']);

    if (sanitized.date && !validateDateString(sanitized.date as string)) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
    }

    if (sanitized.category && !validateEnum(sanitized.category as string, EXPENSE_CATEGORY_VALUES)) {
      return NextResponse.json({ error: 'Invalid expense category' }, { status: 400 });
    }

    if (sanitized.amount !== undefined && (typeof sanitized.amount !== 'number' || (sanitized.amount as number) <= 0)) {
      return NextResponse.json({ error: 'Amount must be a positive number' }, { status: 400 });
    }

    const expense = await updateExpense(id, sanitized as Parameters<typeof updateExpense>[1], user.id);
    return NextResponse.json(expense);
  } catch (error) {
    if (error instanceof TripAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error updating expense:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to update expense' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const rateLimited = rateLimit(request, 'write');
    if (rateLimited) return rateLimited;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id } = await params;
    if (!validateUUID(id)) {
      return NextResponse.json({ error: 'Invalid expense ID' }, { status: 400 });
    }

    const tripId = await tripIdForExpense(id);
    if (!tripId) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }
    await requireTripAccess(tripId, user.id, 'edit');

    await deleteExpense(id, user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof TripAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error deleting expense:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to delete expense' }, { status: 500 });
  }
}
