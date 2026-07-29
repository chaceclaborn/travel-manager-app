import prisma from '@/lib/prisma';
import {
  resolveTripCapability,
  satisfies,
  TripAccessError,
  type TripAccess,
  type TripCapability,
} from './trip-access-core';

/**
 * Database-backed half of the trip authorization chokepoint.
 *
 * The decision logic itself lives in ./trip-access-core, which imports nothing —
 * @/lib/prisma throws at module scope without DB_PASSWORD, so keeping the core
 * pure is what lets the permission matrix be exhaustively unit-tested. Callers
 * import THIS module and get both halves.
 */
export * from './trip-access-core';

/**
 * Authorize `userId` for `need` on `tripId`, or throw TripAccessError.
 *
 * Two indexed queries for a collaborator, one for an owner.
 */
export async function requireTripAccess(
  tripId: string,
  userId: string,
  need: TripCapability
): Promise<TripAccess> {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: {
      id: true,
      userId: true,
      collaborators: {
        where: { userId },
        select: { role: true, status: true },
      },
    },
  });

  if (!trip) throw new TripAccessError('Trip not found', 404);

  const collaborator = trip.collaborators[0] ?? null;
  const isOwner = trip.userId === userId;

  // Only pay for the friendship lookup when it can change the answer.
  const friendshipAccepted =
    isOwner || !collaborator ? false : await areUsersConnected(userId, trip.userId);

  const viewerRole = resolveTripCapability({
    ownerId: trip.userId,
    viewerId: userId,
    collaborator,
    friendshipAccepted,
  });

  if (!viewerRole) {
    // Self-heal: an ACCEPTED row whose friendship is gone is dead weight that
    // would otherwise keep showing the trip in list queries. Best-effort — the
    // per-request check above is what makes revocation *safe*, this only keeps
    // the data tidy.
    if (collaborator && collaborator.status === 'ACCEPTED') {
      prisma.tripCollaborator
        .deleteMany({ where: { tripId, userId } })
        .catch(() => {});
    }
    throw new TripAccessError('Trip not found', 404);
  }

  if (!satisfies(viewerRole, need)) {
    throw new TripAccessError(
      need === 'owner'
        ? 'Only the trip owner can do that'
        : 'You have view-only access to this trip',
      403
    );
  }

  return { tripId, ownerId: trip.userId, viewerRole, isOwner };
}

/**
 * Is there a live ACCEPTED Friendship between these two accounts?
 *
 * Deliberately NOT built on listConnections() (which also returns PENDING rows)
 * and deliberately NOT on Friend.linkedUserId (which survives unfriending, and
 * which linkContact may set by adopting a hand-typed contact on an email match
 * alone). Only the Friendship row means "connected".
 */
export async function areUsersConnected(a: string, b: string): Promise<boolean> {
  if (a === b) return false;
  const row = await prisma.friendship.findFirst({
    where: {
      status: 'ACCEPTED',
      OR: [
        { requesterId: a, addresseeId: b },
        { requesterId: b, addresseeId: a },
      ],
    },
    select: { id: true },
  });
  return !!row;
}

/** Ids of every account with a live ACCEPTED Friendship to `userId`. */
export async function acceptedFriendIds(userId: string): Promise<string[]> {
  const rows = await prisma.friendship.findMany({
    where: {
      status: 'ACCEPTED',
      OR: [{ requesterId: userId }, { addresseeId: userId }],
    },
    select: { requesterId: true, addresseeId: true },
  });
  return rows.map((r) => (r.requesterId === userId ? r.addresseeId : r.requesterId));
}

/**
 * Where-fragment for "trips this user can see" — their own plus trips shared
 * with them.
 *
 * Friendship-aware for the same reason requireTripAccess is: a stale
 * collaborator row must not be able to surface even trip metadata in a list.
 */
export async function tripScopeWhere(userId: string) {
  const friendIds = await acceptedFriendIds(userId);
  if (friendIds.length === 0) return { userId };
  return {
    OR: [
      { userId },
      {
        AND: [
          { userId: { in: friendIds } },
          { collaborators: { some: { userId, status: 'ACCEPTED' as const } } },
        ],
      },
    ],
  };
}

