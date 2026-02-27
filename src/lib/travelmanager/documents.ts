import prisma from '@/lib/prisma';
import type { CreateTravelDocumentInput, UpdateTravelDocumentInput } from './types';

export async function getDocuments(userId: string) {
  return prisma.travelDocument.findMany({
    where: { userId },
    orderBy: { expiryDate: { sort: 'asc', nulls: 'last' } },
  });
}

export async function getDocumentById(id: string, userId: string) {
  return prisma.travelDocument.findFirst({
    where: { id, userId },
  });
}

export async function createDocument(data: CreateTravelDocumentInput, userId: string) {
  return prisma.travelDocument.create({
    data: {
      type: data.type,
      label: data.label,
      number: data.number,
      issueDate: data.issueDate ? new Date(data.issueDate) : undefined,
      expiryDate: data.expiryDate ? new Date(data.expiryDate) : undefined,
      country: data.country,
      filePath: data.filePath,
      notes: data.notes,
      user: { connect: { id: userId } },
    },
  });
}

export async function updateDocument(id: string, data: UpdateTravelDocumentInput, userId: string) {
  const doc = await prisma.travelDocument.findFirst({ where: { id, userId } });
  if (!doc) throw new Error('Document not found');

  const updateData: Record<string, unknown> = { ...data };
  if (data.issueDate) updateData.issueDate = new Date(data.issueDate);
  if (data.expiryDate) updateData.expiryDate = new Date(data.expiryDate);

  return prisma.travelDocument.update({
    where: { id },
    data: updateData,
  });
}

export async function deleteDocument(id: string, userId: string) {
  const doc = await prisma.travelDocument.findFirst({ where: { id, userId } });
  if (!doc) throw new Error('Document not found');

  return prisma.travelDocument.delete({ where: { id } });
}

export async function getExpiringDocuments(userId: string, withinDays: number) {
  const now = new Date();
  const cutoff = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000);

  return prisma.travelDocument.findMany({
    where: {
      userId,
      expiryDate: { lte: cutoff },
    },
    orderBy: { expiryDate: 'asc' },
  });
}
