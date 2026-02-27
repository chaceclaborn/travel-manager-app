import prisma from '@/lib/prisma';
import type { CreateExpenseInput, UpdateExpenseInput } from './types';

async function verifyTripOwnership(tripId: string, userId: string) {
  const trip = await prisma.trip.findFirst({ where: { id: tripId, userId } });
  if (!trip) throw new Error('Trip not found');
  return trip;
}

async function verifyExpenseOwnership(expenseId: string, userId: string) {
  const expense = await prisma.expense.findUnique({
    where: { id: expenseId },
    select: { tripId: true, trip: { select: { userId: true } } },
  });
  if (!expense || expense.trip.userId !== userId) throw new Error('Expense not found');
  return expense;
}

export async function getExpenses(tripId: string, userId: string) {
  await verifyTripOwnership(tripId, userId);
  return prisma.expense.findMany({
    where: { tripId },
    orderBy: { date: 'desc' },
  });
}

export async function createExpense(data: CreateExpenseInput, userId: string) {
  await verifyTripOwnership(data.tripId, userId);
  return prisma.expense.create({
    data: {
      amount: data.amount,
      currency: data.currency ?? 'USD',
      category: data.category,
      description: data.description,
      date: new Date(data.date),
      receiptPath: data.receiptPath,
      user: { connect: { id: userId } },
      trip: { connect: { id: data.tripId } },
    },
  });
}

export async function updateExpense(id: string, data: UpdateExpenseInput, userId: string) {
  await verifyExpenseOwnership(id, userId);
  const updateData: Record<string, unknown> = { ...data };
  if (data.date) updateData.date = new Date(data.date);
  return prisma.expense.update({
    where: { id },
    data: updateData,
  });
}

export async function deleteExpense(id: string, userId: string) {
  await verifyExpenseOwnership(id, userId);
  return prisma.expense.delete({ where: { id } });
}

export async function getTripExpenseTotal(tripId: string, userId: string) {
  await verifyTripOwnership(tripId, userId);
  const result = await prisma.expense.aggregate({
    where: { tripId },
    _sum: { amount: true },
  });
  return result._sum.amount ?? 0;
}
