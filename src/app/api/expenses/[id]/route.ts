import { NextRequest, NextResponse } from 'next/server';
import { updateExpense, deleteExpense } from '@/lib/travelmanager/expenses';
import { requireAuth } from '@/lib/travelmanager/auth';
import prisma from '@/lib/prisma';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id } = await params;
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
    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id } = await params;
    const body = await request.json();
    const expense = await updateExpense(id, body, user.id);
    return NextResponse.json(expense);
  } catch (error) {
    console.error('Error updating expense:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to update expense' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id } = await params;
    await deleteExpense(id, user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting expense:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to delete expense' }, { status: 500 });
  }
}
