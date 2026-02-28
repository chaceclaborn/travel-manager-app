import { NextRequest, NextResponse } from 'next/server';
import { updateExpense, deleteExpense } from '@/lib/travelmanager/expenses';
import { requireAuth } from '@/lib/travelmanager/auth';
import { rateLimit } from '@/lib/rate-limit';
import prisma from '@/lib/prisma';
import { sanitizeObject, validateUUID, validateDateString, validateEnum, EXPENSE_CATEGORY_VALUES } from '@/lib/sanitize';

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

    const trip = await prisma.trip.findFirst({ where: { id: expense.tripId, userId: user.id } });
    if (!trip) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    return NextResponse.json(expense);
  } catch (error) {
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
    await deleteExpense(id, user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting expense:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to delete expense' }, { status: 500 });
  }
}
