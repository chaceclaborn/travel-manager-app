import { NextRequest, NextResponse } from 'next/server';
import { getExpenses, createExpense } from '@/lib/travelmanager/expenses';
import { requireAuth } from '@/lib/travelmanager/auth';
import { sanitizeObject, validateUUID, validateDateString, validateEnum, EXPENSE_CATEGORY_VALUES } from '@/lib/sanitize';

const EXPENSE_ALLOWED_FIELDS = ['amount', 'currency', 'category', 'description', 'date', 'receiptPath'];

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id } = await params;
    if (!validateUUID(id)) {
      return NextResponse.json({ error: 'Invalid trip ID' }, { status: 400 });
    }
    const expenses = await getExpenses(id, user.id);
    return NextResponse.json(expenses);
  } catch (error) {
    console.error('Error fetching expenses:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to fetch expenses' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id: tripId } = await params;
    if (!validateUUID(tripId)) {
      return NextResponse.json({ error: 'Invalid trip ID' }, { status: 400 });
    }

    const body = await request.json();
    const sanitized = sanitizeObject(body, EXPENSE_ALLOWED_FIELDS);

    if (!sanitized.amount || !sanitized.date) {
      return NextResponse.json({ error: 'Amount and date are required' }, { status: 400 });
    }

    if (typeof sanitized.amount !== 'number' || (sanitized.amount as number) <= 0) {
      return NextResponse.json({ error: 'Amount must be a positive number' }, { status: 400 });
    }

    if (!validateDateString(sanitized.date as string)) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
    }

    if (sanitized.category && !validateEnum(sanitized.category as string, EXPENSE_CATEGORY_VALUES)) {
      return NextResponse.json({ error: 'Invalid expense category' }, { status: 400 });
    }

    const expense = await createExpense({ ...sanitized, tripId } as Parameters<typeof createExpense>[0], user.id);
    return NextResponse.json(expense, { status: 201 });
  } catch (error) {
    console.error('Error creating expense:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to create expense' }, { status: 500 });
  }
}
