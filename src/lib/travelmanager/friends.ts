import prisma from '@/lib/prisma';
import type { CreateFriendInput, UpdateFriendInput, FriendWithTrips } from './types';

const friendInclude = {
  trips: { include: { trip: true } },
};

export async function getFriends(userId: string) {
  return prisma.friend.findMany({
    where: { userId },
    include: friendInclude,
    orderBy: { name: 'asc' },
  });
}

export async function getFriendById(id: string, userId: string): Promise<FriendWithTrips | null> {
  return prisma.friend.findFirst({
    where: { id, userId },
    include: friendInclude,
  });
}

export async function createFriend(data: CreateFriendInput, userId: string) {
  return prisma.friend.create({
    data: {
      name: data.name,
      email: data.email,
      phone: data.phone,
      notes: data.notes,
      user: { connect: { id: userId } },
    },
    include: friendInclude,
  });
}

export async function updateFriend(id: string, data: UpdateFriendInput, userId: string) {
  const friend = await prisma.friend.findFirst({ where: { id, userId } });
  if (!friend) throw new Error('Friend not found');

  return prisma.friend.update({
    where: { id },
    data,
    include: friendInclude,
  });
}

export async function deleteFriend(id: string, userId: string) {
  const friend = await prisma.friend.findFirst({ where: { id, userId } });
  if (!friend) throw new Error('Friend not found');

  return prisma.friend.delete({ where: { id } });
}
