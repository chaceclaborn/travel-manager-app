import prisma from '@/lib/prisma';
import { requireTripAccess, TripAccessError, type TripCapability } from './trip-access';
import type { CreateExpenseInput, UpdateExpenseInput } from './types';

/**
 * Expenses are reached by their own id on /api/expenses/[id], which carries no
 * tripId — so load the row first and let its trip answer. Expense.userId is now
 * the author and grants nothing on its own; the trip is the authority.
 */
async function requireExpenseAccess(
  expenseId: string,
  userId: string,
  need: Exclude<TripCapability, 'owner'>
) {
  const expense = await prisma.expense.findUnique({
    where: { id: expenseId },
    select: { tripId: true },
  });
  if (!expense) throw new TripAccessError('Expense not found', 404);
  return requireTripAccess(expense.tripId, userId, need);
}

export async function getExpenses(tripId: string, userId: string) {
  await requireTripAccess(tripId, userId, 'view');
  return prisma.expense.findMany({
    where: { tripId },
    orderBy: { date: 'desc' },
  });
}

export async function createExpense(data: CreateExpenseInput, userId: string) {
  await requireTripAccess(data.tripId, userId, 'edit');
  return prisma.expense.create({
    data: {
      amount: data.amount,
      currency: data.currency ?? 'USD',
      category: data.category,
      description: data.description,
      date: new Date(data.date),
      receiptPath: data.receiptPath,
      // The author, which is not necessarily the trip owner. Access is decided by
      // the trip; this is kept so the row can be reattributed if the author ever
      // deletes their account.
      user: { connect: { id: userId } },
      trip: { connect: { id: data.tripId } },
    },
  });
}

export async function updateExpense(id: string, data: UpdateExpenseInput, userId: string) {
  await requireExpenseAccess(id, userId, 'edit');
  const updateData: Record<string, unknown> = { ...data };
  if (data.date) updateData.date = new Date(data.date);
  return prisma.expense.update({
    where: { id },
    data: updateData,
  });
}

export async function deleteExpense(id: string, userId: string) {
  await requireExpenseAccess(id, userId, 'edit');
  return prisma.expense.delete({ where: { id } });
}

export async function getTripExpenseTotal(tripId: string, userId: string) {
  await requireTripAccess(tripId, userId, 'view');
  const result = await prisma.expense.aggregate({
    where: { tripId },
    _sum: { amount: true },
  });
  return result._sum.amount ?? 0;
}
