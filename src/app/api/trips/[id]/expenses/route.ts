import { NextRequest, NextResponse } from 'next/server';
import { getExpenses, createExpense } from '@/lib/travelmanager/expenses';
import { requireAuth } from '@/lib/travelmanager/auth';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id } = await params;
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
    const body = await request.json();

    if (!body.amount || !body.date) {
      return NextResponse.json({ error: 'Amount and date are required' }, { status: 400 });
    }

    if (typeof body.amount !== 'number' || body.amount <= 0) {
      return NextResponse.json({ error: 'Amount must be a positive number' }, { status: 400 });
    }

    const expense = await createExpense({ ...body, tripId }, user.id);
    return NextResponse.json(expense, { status: 201 });
  } catch (error) {
    console.error('Error creating expense:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to create expense' }, { status: 500 });
  }
}
