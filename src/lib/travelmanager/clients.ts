import prisma from '@/lib/prisma';
import type { CreateClientInput, UpdateClientInput, ClientWithTrips } from './types';

const clientInclude = {
  trips: { include: { trip: true } },
};

export async function getClients(userId: string) {
  return prisma.client.findMany({
    where: { userId },
    include: clientInclude,
    orderBy: { name: 'asc' },
  });
}

export async function getClientById(id: string, userId: string): Promise<ClientWithTrips | null> {
  return prisma.client.findFirst({
    where: { id, userId },
    include: clientInclude,
  });
}

export async function createClient(data: CreateClientInput, userId: string) {
  return prisma.client.create({
    data: {
      name: data.name,
      company: data.company,
      email: data.email,
      phone: data.phone,
      notes: data.notes,
      user: { connect: { id: userId } },
    },
    include: clientInclude,
  });
}

export async function updateClient(id: string, data: UpdateClientInput, userId: string) {
  const client = await prisma.client.findFirst({ where: { id, userId } });
  if (!client) throw new Error('Client not found');

  return prisma.client.update({
    where: { id },
    data,
    include: clientInclude,
  });
}

export async function deleteClient(id: string, userId: string) {
  const client = await prisma.client.findFirst({ where: { id, userId } });
  if (!client) throw new Error('Client not found');

  return prisma.client.delete({ where: { id } });
}
