import prisma from '@/lib/prisma';
import { normalizeUsername } from './username';
import { sendPushToUser } from '@/lib/push/dispatch';
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

/** What to call someone in a contact row or a notification. */
function displayName(u: { name: string | null; username: string | null }): string {
  return u.name?.trim() || (u.username ? `@${u.username}` : 'Someone');
}

/**
 * Turn an accepted connection into a usable contact on BOTH sides.
 *
 * Without this an accepted Friendship was inert — it drew a row in the
 * Connections list and nothing else in the app ever read it, so "we're
 * connected" didn't let you do anything. Creating a linked Friend puts the
 * person straight into the trip companion picker.
 *
 * Idempotent, and never clobbers an existing contact: if you already had a
 * hand-typed "Raeha" we link that row rather than creating a duplicate. Uses
 * the unique (userId, linkedUserId) index to stay safe under concurrent
 * accepts — the reverse-direction accept race is real, since both people can
 * tap Accept at once.
 */
async function linkContact(ownerId: string, otherId: string): Promise<void> {
  const other = await prisma.user.findUnique({
    where: { id: otherId },
    select: { id: true, name: true, username: true, email: true },
  });
  if (!other) return;

  const already = await prisma.friend.findFirst({
    where: { userId: ownerId, linkedUserId: otherId },
    select: { id: true },
  });
  if (already) return;

  // Adopt a matching unlinked contact instead of duplicating it.
  const byEmail = other.email
    ? await prisma.friend.findFirst({
        where: { userId: ownerId, linkedUserId: null, email: other.email },
        select: { id: true },
      })
    : null;

  try {
    if (byEmail) {
      await prisma.friend.update({
        where: { id: byEmail.id },
        data: { linkedUserId: otherId },
      });
      return;
    }
    await prisma.friend.create({
      data: {
        userId: ownerId,
        name: displayName(other),
        email: other.email ?? null,
        linkedUserId: otherId,
      },
    });
  } catch {
    // Unique violation → the other side of a simultaneous accept won. Fine.
  }
}

/**
 * Everything that should happen when two accounts become connected: contacts
 * on both sides, and a push to whoever wasn't the one tapping Accept.
 *
 * Never throws. This runs alongside the mutation that already succeeded, and a
 * failed contact link or a dead APNs token must not turn an accepted friend
 * request into a 500.
 */
async function onFriendshipAccepted(accepterId: string, otherId: string): Promise<void> {
  try {
    await Promise.all([linkContact(accepterId, otherId), linkContact(otherId, accepterId)]);
    const accepter = await prisma.user.findUnique({
      where: { id: accepterId },
      select: { name: true, username: true },
    });
    if (!accepter) return;
    await sendPushToUser(otherId, {
      title: 'Friend request accepted',
      body: `${displayName(accepter)} accepted your friend request.`,
      url: '/friends',
    });
  } catch (err) {
    console.error('[friendships] post-accept side effects failed:', err instanceof Error ? err.message : err);
  }
}

/**
 * Case-insensitive username search, excluding the current user. Returns up to
 * 10 public summaries. An empty/blank query yields no results. Accounts that
 * opted out of discoverability (`isPublic === false`) are excluded — they can
 * still be added directly by anyone who knows their exact @handle.
 */
export async function searchUsers(currentUserId: string, q: string): Promise<PublicUserSummary[]> {
  const query = q.trim();
  if (!query) return [];

  const users = await prisma.user.findMany({
    where: {
      id: { not: currentUserId },
      isPublic: true,
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
      // Adding someone who had already asked you IS an accept — same side
      // effects as tapping Accept in the Connections list.
      await onFriendshipAccepted(userId, addressee.id);
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

  const requester = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, username: true },
  });
  if (requester) {
    // Fire-and-forget: a push failure must not fail the request itself.
    await sendPushToUser(addressee.id, {
      title: 'New friend request',
      body: `${displayName(requester)} wants to connect with you.`,
      url: '/friends',
    }).catch(() => {});
  }
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
    await onFriendshipAccepted(userId, row.requesterId);
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

  // Unfriending also ends any trip collaboration between the two, in both
  // directions. This is housekeeping, not the security boundary: what actually
  // makes revocation safe is requireTripAccess() re-checking the friendship on
  // every single request, so access dies the instant the row above is deleted
  // whether or not this cleanup runs. Without it the membership lists would
  // simply show people who can no longer open the trip.
  await prisma.tripCollaborator
    .deleteMany({
      where: {
        OR: [
          { userId: row.requesterId, trip: { userId: row.addresseeId } },
          { userId: row.addresseeId, trip: { userId: row.requesterId } },
        ],
      },
    })
    .catch(() => {});
}
