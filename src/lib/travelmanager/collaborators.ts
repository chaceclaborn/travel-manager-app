import prisma from '@/lib/prisma';
import { sendPushToUser } from '@/lib/push/dispatch';
import {
  requireTripAccess,
  areUsersConnected,
  TripAccessError,
  type TripRoleValue,
} from './trip-access';

/**
 * Trip collaboration: inviting a connected friend onto a trip.
 *
 * Authorization for the trip itself is never decided here — every entry point
 * defers to requireTripAccess(). This module owns the membership lifecycle
 * only: invite, accept, decline, remove, leave, role change.
 */

/** Beyond this a trip is a mailing list, not a collaboration. */
const MAX_COLLABORATORS_PER_TRIP = 10;

const publicUserSelect = {
  id: true,
  username: true,
  name: true,
  avatarUrl: true,
} as const;

function displayName(u: { name: string | null; username: string | null }): string {
  return u.name?.trim() || (u.username ? `@${u.username}` : 'Someone');
}

/**
 * Invite a friend onto a trip. Owner-only.
 *
 * The invitee must be a live ACCEPTED friend. That check runs against the
 * Friendship row via areUsersConnected() — never against Friend.linkedUserId,
 * which survives unfriending and can be set by adopting a hand-typed contact on
 * an email match alone.
 */
export async function inviteCollaborator(
  tripId: string,
  ownerId: string,
  inviteeId: string,
  role: TripRoleValue
): Promise<void> {
  await requireTripAccess(tripId, ownerId, 'owner');

  if (inviteeId === ownerId) {
    throw new TripAccessError('You already own this trip', 400);
  }
  if (!(await areUsersConnected(ownerId, inviteeId))) {
    throw new TripAccessError('You can only invite people you are connected with', 403);
  }

  const count = await prisma.tripCollaborator.count({ where: { tripId } });
  if (count >= MAX_COLLABORATORS_PER_TRIP) {
    throw new TripAccessError(
      `A trip can have at most ${MAX_COLLABORATORS_PER_TRIP} collaborators`,
      409
    );
  }

  try {
    await prisma.tripCollaborator.create({
      data: { tripId, userId: inviteeId, invitedById: ownerId, role, status: 'PENDING' },
    });
  } catch {
    // The unique index on (tripId, userId) doubles as duplicate-invite
    // protection, so a P2002 here means they are already invited or already a
    // collaborator. Either way there is nothing to do and nothing to notify.
    throw new TripAccessError('That person is already on this trip', 409);
  }

  const owner = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { name: true, username: true },
  });
  if (!owner) return;

  // The trip title is deliberately absent. This renders on a lock screen before
  // the recipient has accepted anything, and titles carry client names on work
  // trips. '/trips' is a one-segment path that exists in the iOS static export
  // and passes through normalizeDeepLink unchanged.
  await sendPushToUser(inviteeId, {
    title: 'Trip invitation',
    body: `${displayName(owner)} invited you to collaborate on a trip.`,
    url: '/trips',
  }).catch(() => {});
}

/** Everyone on a trip. Requires view access; the owner is not a row. */
export async function listCollaborators(tripId: string, userId: string) {
  const access = await requireTripAccess(tripId, userId, 'view');
  const rows = await prisma.tripCollaborator.findMany({
    where: { tripId },
    select: {
      id: true,
      role: true,
      status: true,
      createdAt: true,
      user: { select: publicUserSelect },
    },
    orderBy: { createdAt: 'asc' },
  });
  // The caller needs to know which row is theirs in order to leave, and the
  // client has no reliable handle on its own user id. Naming it here beats the
  // client guessing "the first accepted row".
  const myRowId = rows.find((r) => r.user.id === userId)?.id ?? null;
  return {
    collaborators: rows,
    viewerRole: access.viewerRole,
    isOwner: access.isOwner,
    myRowId,
  };
}

/**
 * Friends the owner could still invite: connected, not already on the trip.
 * Computed server-side so the exclusion logic cannot drift from the invite
 * precondition.
 */
export async function listInviteCandidates(tripId: string, ownerId: string) {
  await requireTripAccess(tripId, ownerId, 'owner');

  const friendships = await prisma.friendship.findMany({
    where: {
      status: 'ACCEPTED',
      OR: [{ requesterId: ownerId }, { addresseeId: ownerId }],
    },
    select: {
      requester: { select: publicUserSelect },
      addressee: { select: publicUserSelect },
      requesterId: true,
    },
  });
  const friends = friendships.map((f) => (f.requesterId === ownerId ? f.addressee : f.requester));

  const existing = await prisma.tripCollaborator.findMany({
    where: { tripId },
    select: { userId: true },
  });
  const taken = new Set(existing.map((e) => e.userId));
  return friends.filter((f) => !taken.has(f.id));
}

/**
 * My pending invitations, with a strict whitelist.
 *
 * Enough to decide whether to accept, and nothing more — no notes, no budget,
 * no children. A PENDING row grants no trip access, so this must not become a
 * back door to trip contents.
 */
export async function listMyInvitations(userId: string) {
  const rows = await prisma.tripCollaborator.findMany({
    where: { userId, status: 'PENDING' },
    select: {
      id: true,
      role: true,
      createdAt: true,
      trip: {
        select: { id: true, title: true, destination: true, startDate: true, endDate: true },
      },
      invitedBy: { select: publicUserSelect },
    },
    orderBy: { createdAt: 'desc' },
  });
  return rows;
}

/** Trips shared with me that I have accepted. */
export async function listMyCollaborations(userId: string) {
  return prisma.tripCollaborator.findMany({
    where: { userId, status: 'ACCEPTED' },
    select: {
      id: true,
      role: true,
      acceptedAt: true,
      trip: { select: { id: true, title: true, destination: true, startDate: true, endDate: true } },
    },
    orderBy: { acceptedAt: 'desc' },
  });
}

/** Accept an invitation addressed to me. */
export async function acceptInvitation(rowId: string, userId: string): Promise<void> {
  const row = await prisma.tripCollaborator.findUnique({
    where: { id: rowId },
    select: { id: true, userId: true, status: true, tripId: true, trip: { select: { userId: true, title: true } } },
  });
  if (!row) throw new TripAccessError('Invitation not found', 404);
  if (row.userId !== userId) throw new TripAccessError('Not your invitation', 403);
  if (row.status !== 'PENDING') throw new TripAccessError('Already accepted', 409);

  // Re-verify rather than trust the invite: the friendship may have ended
  // between the invitation and this moment, and an ACCEPTED row would then be
  // access we never intended to grant.
  if (!(await areUsersConnected(userId, row.trip.userId))) {
    await prisma.tripCollaborator.delete({ where: { id: rowId } }).catch(() => {});
    throw new TripAccessError('You are no longer connected with the trip owner', 403);
  }

  await prisma.tripCollaborator.update({
    where: { id: rowId },
    data: { status: 'ACCEPTED', acceptedAt: new Date() },
  });

  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, username: true },
  });
  if (!me) return;
  // The owner IS authorized for the title, so this one can name the trip.
  await sendPushToUser(row.trip.userId, {
    title: 'Trip collaborator',
    body: `${displayName(me)} joined ${row.trip.title}.`,
    url: '/trips',
  }).catch(() => {});
}

/**
 * Decline an invitation, or leave a trip I had accepted. Both hard-delete.
 *
 * No push either way: only positive, actionable events notify. Nobody should
 * get a lock-screen notification telling them they were turned down.
 */
export async function declineOrLeave(rowId: string, userId: string): Promise<void> {
  const row = await prisma.tripCollaborator.findUnique({
    where: { id: rowId },
    select: { id: true, userId: true },
  });
  if (!row) throw new TripAccessError('Invitation not found', 404);
  if (row.userId !== userId) throw new TripAccessError('Not your invitation', 403);
  await prisma.tripCollaborator.delete({ where: { id: rowId } });
}

/** Remove someone from a trip. Owner-only. Silent by design. */
export async function removeCollaborator(
  tripId: string,
  ownerId: string,
  targetUserId: string
): Promise<void> {
  await requireTripAccess(tripId, ownerId, 'owner');
  await prisma.tripCollaborator.deleteMany({ where: { tripId, userId: targetUserId } });
}

/** Change someone's role. Owner-only. Takes effect on their next request. */
export async function setCollaboratorRole(
  tripId: string,
  ownerId: string,
  targetUserId: string,
  role: TripRoleValue
): Promise<void> {
  await requireTripAccess(tripId, ownerId, 'owner');
  const updated = await prisma.tripCollaborator.updateMany({
    where: { tripId, userId: targetUserId },
    data: { role },
  });
  if (updated.count === 0) throw new TripAccessError('Collaborator not found', 404);
}
