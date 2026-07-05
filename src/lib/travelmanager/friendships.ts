import prisma from '@/lib/prisma';
import { normalizeUsername } from './username';
import type { FriendConnection, PublicUserSummary } from './types';

// Errors carry an HTTP status the API routes translate directly. Anything that
// escapes without a status is treated as a 500 by the route handlers.
export class FriendshipError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'FriendshipError';
    this.status = status;
  }
}

const publicUserSelect = {
  id: true,
  username: true,
  name: true,
  avatarUrl: true,
} as const;

/**
 * Case-insensitive username search, excluding the current user. Returns up to
 * 10 public summaries. An empty/blank query yields no results.
 */
export async function searchUsers(currentUserId: string, q: string): Promise<PublicUserSummary[]> {
  const query = q.trim();
  if (!query) return [];

  const users = await prisma.user.findMany({
    where: {
      id: { not: currentUserId },
      username: { contains: query, mode: 'insensitive' },
    },
    select: publicUserSelect,
    take: 10,
    orderBy: { username: 'asc' },
  });

  return users;
}

/**
 * Every friendship touching this user, mapped to the OTHER person plus our
 * relationship. `direction` is 'incoming' only for a PENDING row where we are
 * the addressee (they asked us); otherwise 'outgoing'.
 */
export async function listConnections(userId: string): Promise<FriendConnection[]> {
  const rows = await prisma.friendship.findMany({
    where: {
      OR: [{ requesterId: userId }, { addresseeId: userId }],
    },
    include: {
      requester: { select: publicUserSelect },
      addressee: { select: publicUserSelect },
    },
    orderBy: { createdAt: 'desc' },
  });

  return rows.map((row) => {
    const isRequester = row.requesterId === userId;
    const other = isRequester ? row.addressee : row.requester;
    const direction: 'incoming' | 'outgoing' =
      !isRequester && row.status === 'PENDING' ? 'incoming' : 'outgoing';
    return {
      friendshipId: row.id,
      status: row.status,
      direction,
      user: other,
    };
  });
}

/**
 * Send a friend request to `username`. If the target has already sent us a
 * PENDING request, accept it instead of creating a duplicate. Guards against
 * self-requests and existing connections in either direction.
 */
export async function sendFriendRequest(userId: string, username: string): Promise<void> {
  const handle = normalizeUsername(username);
  if (!handle) throw new FriendshipError('Username is required', 400);

  const addressee = await prisma.user.findFirst({
    where: { username: handle },
    select: { id: true },
  });
  if (!addressee) throw new FriendshipError('User not found', 404);
  if (addressee.id === userId) throw new FriendshipError('You cannot add yourself', 400);

  // Look for any existing row in either direction.
  const existing = await prisma.friendship.findFirst({
    where: {
      OR: [
        { requesterId: userId, addresseeId: addressee.id },
        { requesterId: addressee.id, addresseeId: userId },
      ],
    },
  });

  if (existing) {
    // They already requested us and it is still pending -> accept it.
    if (
      existing.status === 'PENDING' &&
      existing.requesterId === addressee.id &&
      existing.addresseeId === userId
    ) {
      await prisma.friendship.update({
        where: { id: existing.id },
        data: { status: 'ACCEPTED' },
      });
      return;
    }
    throw new FriendshipError('A connection already exists', 409);
  }

  await prisma.friendship.create({
    data: {
      requesterId: userId,
      addresseeId: addressee.id,
      status: 'PENDING',
    },
  });
}

/**
 * Accept or decline/cancel/remove a friendship. Accepting is only permitted by
 * the addressee of a PENDING row. Removing (accept=false) is permitted by
 * either the requester or the addressee.
 */
export async function respondToRequest(
  userId: string,
  friendshipId: string,
  accept: boolean
): Promise<void> {
  const row = await prisma.friendship.findUnique({ where: { id: friendshipId } });
  if (!row) throw new FriendshipError('Friendship not found', 404);

  if (accept) {
    if (row.status !== 'PENDING' || row.addresseeId !== userId) {
      throw new FriendshipError('Not allowed to accept this request', 403);
    }
    await prisma.friendship.update({
      where: { id: friendshipId },
      data: { status: 'ACCEPTED' },
    });
    return;
  }

  await removeFriendship(userId, friendshipId);
}

/** Delete a friendship (decline/cancel/unfriend). Requester or addressee only. */
export async function removeFriendship(userId: string, friendshipId: string): Promise<void> {
  const row = await prisma.friendship.findUnique({ where: { id: friendshipId } });
  if (!row) throw new FriendshipError('Friendship not found', 404);

  if (row.requesterId !== userId && row.addresseeId !== userId) {
    throw new FriendshipError('Not allowed to remove this friendship', 403);
  }

  await prisma.friendship.delete({ where: { id: friendshipId } });
}
