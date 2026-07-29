import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import prisma from '@/lib/prisma';
import { requireTripAccess, TripAccessError } from './trip-access';
import {
  inviteCollaborator,
  listCollaborators,
  listInviteCandidates,
  listMyInvitations,
  acceptInvitation,
  declineOrLeave,
  removeCollaborator,
  setCollaboratorRole,
} from './collaborators';
import { getTripById, getTrips, updateTrip, deleteAllUserData } from './trips';
import { getBookings } from './bookings';
import { removeFriendship } from './friendships';

/**
 * Collaborative trips, end to end against a real database.
 *
 * trip-access.test.ts proves the permission DECISION is right, in isolation.
 * This suite proves the decision is actually wired up: that the queries, joins,
 * cascades and redaction behave when a second real user exists. Those are
 * different failure modes, and the two that shipped as bugs during development
 * were both of the second kind — a write path that echoed the unredacted row,
 * and a bulk-delete whose `{ userId }` filter quietly stopped meaning
 * "ownership" once userId came to mean "author".
 *
 * Fixture: OWNER owns TRIP. FRIEND is a connected account. STRANGER is not.
 * Every test re-seeds, so they can run in any order.
 */

const OWNER = 'it-owner';
const FRIEND = 'it-friend';
const STRANGER = 'it-stranger';
const TRIP = 'it-trip';
const ALL_USERS = [OWNER, FRIEND, STRANGER];

/** The status a TripAccessError carried, or 'ok' if the call succeeded. */
async function statusOf(fn: () => Promise<unknown>): Promise<number | 'ok'> {
  try {
    await fn();
    return 'ok';
  } catch (e) {
    if (e instanceof TripAccessError) return e.status;
    throw e;
  }
}

async function wipe() {
  await prisma.tripCollaborator.deleteMany({ where: { trip: { userId: { in: ALL_USERS } } } });
  await prisma.expense.deleteMany({ where: { userId: { in: ALL_USERS } } });
  await prisma.booking.deleteMany({ where: { userId: { in: ALL_USERS } } });
  await prisma.trip.deleteMany({ where: { userId: { in: ALL_USERS } } });
  await prisma.friend.deleteMany({ where: { userId: { in: ALL_USERS } } });
  await prisma.friendship.deleteMany({
    where: { OR: [{ requesterId: { in: ALL_USERS } }, { addresseeId: { in: ALL_USERS } }] },
  });
  await prisma.user.deleteMany({ where: { id: { in: ALL_USERS } } });
}

/** OWNER + FRIEND connected, STRANGER not, one trip owned by OWNER. */
async function seed() {
  await wipe();
  await prisma.user.createMany({
    data: [
      { id: OWNER, email: 'owner@it.test', name: 'Olive Owner', username: 'olive' },
      { id: FRIEND, email: 'friend@it.test', name: 'Fred Friend', username: 'fred' },
      { id: STRANGER, email: 'stranger@it.test', name: 'Sam Stranger', username: 'sam' },
    ],
  });
  await prisma.trip.create({
    data: {
      id: TRIP,
      userId: OWNER,
      title: 'Kyoto in Spring',
      destination: 'Kyoto, Japan',
      budget: 5000,
      shareToken: 'super-secret-share-token',
      shareEnabled: true,
    },
  });
  await prisma.friendship.create({
    data: { requesterId: OWNER, addresseeId: FRIEND, status: 'ACCEPTED' },
  });
}

/** Put FRIEND on the trip at `role`, already accepted. */
async function addCollaborator(role: 'VIEWER' | 'EDITOR') {
  await inviteCollaborator(TRIP, OWNER, FRIEND, role);
  const invite = (await listMyInvitations(FRIEND))[0];
  await acceptInvitation(invite.id, FRIEND);
  return invite.id;
}

beforeEach(seed);
afterAll(async () => {
  await wipe();
  await prisma.$disconnect();
});

describe('inviting', () => {
  it('only lets the owner invite', async () => {
    expect(await statusOf(() => inviteCollaborator(TRIP, FRIEND, STRANGER, 'VIEWER'))).toBe(404);
  });

  it('refuses to invite someone who is not a connected friend', async () => {
    // The whole point of the friendship precondition: you cannot hand trip
    // access to an arbitrary account id.
    expect(await statusOf(() => inviteCollaborator(TRIP, OWNER, STRANGER, 'EDITOR'))).toBe(403);
  });

  it('refuses to invite yourself', async () => {
    expect(await statusOf(() => inviteCollaborator(TRIP, OWNER, OWNER, 'EDITOR'))).toBe(400);
  });

  it('rejects a duplicate invitation with 409 rather than a second row', async () => {
    await inviteCollaborator(TRIP, OWNER, FRIEND, 'VIEWER');
    expect(await statusOf(() => inviteCollaborator(TRIP, OWNER, FRIEND, 'EDITOR'))).toBe(409);
    expect(await prisma.tripCollaborator.count({ where: { tripId: TRIP } })).toBe(1);
  });

  it('offers only connected friends as candidates, and drops them once invited', async () => {
    const before = await listInviteCandidates(TRIP, OWNER);
    expect(before.map((c) => c.id)).toEqual([FRIEND]); // STRANGER is absent

    await inviteCollaborator(TRIP, OWNER, FRIEND, 'VIEWER');
    expect(await listInviteCandidates(TRIP, OWNER)).toEqual([]);
  });
});

describe('a pending invitation grants nothing', () => {
  it('cannot read the trip', async () => {
    await inviteCollaborator(TRIP, OWNER, FRIEND, 'EDITOR');
    expect(await statusOf(() => getTripById(TRIP, FRIEND))).toBe(404);
  });

  it('does not surface the trip in list queries', async () => {
    await inviteCollaborator(TRIP, OWNER, FRIEND, 'EDITOR');
    expect(await getTrips(FRIEND, 'minimal')).toEqual([]);
  });

  it('exposes only whitelisted preview fields to the invitee', async () => {
    await inviteCollaborator(TRIP, OWNER, FRIEND, 'EDITOR');
    const [invite] = await listMyInvitations(FRIEND);
    // Enough to decide; nothing more. Budget and notes are trip contents.
    expect(Object.keys(invite.trip).sort()).toEqual(
      ['destination', 'endDate', 'id', 'startDate', 'title'].sort()
    );
    expect(invite.trip).not.toHaveProperty('budget');
    expect(invite.trip).not.toHaveProperty('shareToken');
  });
});

describe('accepted collaborators', () => {
  it('lets an EDITOR read and write, but not act as owner', async () => {
    await addCollaborator('EDITOR');
    expect(await statusOf(() => requireTripAccess(TRIP, FRIEND, 'view'))).toBe('ok');
    expect(await statusOf(() => requireTripAccess(TRIP, FRIEND, 'edit'))).toBe('ok');
    expect(await statusOf(() => requireTripAccess(TRIP, FRIEND, 'owner'))).toBe(403);
  });

  it('lets a VIEWER read but never write', async () => {
    await addCollaborator('VIEWER');
    expect(await statusOf(() => requireTripAccess(TRIP, FRIEND, 'view'))).toBe('ok');
    expect(await statusOf(() => updateTrip(TRIP, { title: 'Hijacked' }, FRIEND))).toBe(403);
    expect((await prisma.trip.findUnique({ where: { id: TRIP } }))!.title).toBe('Kyoto in Spring');
  });

  it('surfaces the shared trip in the collaborator list queries', async () => {
    await addCollaborator('VIEWER');
    const trips = await getTrips(FRIEND, 'minimal');
    expect(trips.map((t) => t.id)).toEqual([TRIP]);
    expect(trips[0].viewerRole).toBe('VIEWER');
  });

  it('takes a role change effect immediately', async () => {
    await addCollaborator('VIEWER');
    expect(await statusOf(() => requireTripAccess(TRIP, FRIEND, 'edit'))).toBe(403);
    await setCollaboratorRole(TRIP, OWNER, FRIEND, 'EDITOR');
    expect(await statusOf(() => requireTripAccess(TRIP, FRIEND, 'edit'))).toBe('ok');
  });

  it('tells each side what it is looking at', async () => {
    await addCollaborator('EDITOR');
    const ownerView = await listCollaborators(TRIP, OWNER);
    expect(ownerView.isOwner).toBe(true);
    expect(ownerView.myRowId).toBeNull(); // the owner is not a collaborator row

    const friendView = await listCollaborators(TRIP, FRIEND);
    expect(friendView.isOwner).toBe(false);
    expect(friendView.viewerRole).toBe('EDITOR');
    // Needed to leave: picking "the first accepted row" would remove someone else.
    expect(friendView.myRowId).toBeTruthy();
  });
});

describe('redaction', () => {
  it('never hands a non-owner the share token', async () => {
    await addCollaborator('EDITOR');
    const asOwner = await getTripById(TRIP, OWNER);
    const asFriend = await getTripById(TRIP, FRIEND);

    expect(asOwner).toHaveProperty('shareToken', 'super-secret-share-token');
    // A collaborator holding this could publish a permanent public link.
    expect(asFriend).not.toHaveProperty('shareToken');
    expect(asFriend).not.toHaveProperty('shareEnabled');
    expect(asFriend!.viewerRole).toBe('EDITOR');
  });

  it('redacts the WRITE echo too, not just the read', async () => {
    // The bug that shipped: getTripById was guarded and PUT was not, so the
    // same data was one save away.
    await addCollaborator('EDITOR');
    const echoed = await updateTrip(TRIP, { title: 'Kyoto in Late Spring' }, FRIEND);
    expect(echoed).not.toHaveProperty('shareToken');
    expect(echoed.vendors).toEqual([]);

    const ownerEcho = await updateTrip(TRIP, { title: 'Kyoto in Summer' }, OWNER);
    expect(ownerEcho).toHaveProperty('shareToken', 'super-secret-share-token');
  });

  it('nulls commission figures for a collaborator but not the owner', async () => {
    await addCollaborator('EDITOR');
    await prisma.booking.create({
      data: {
        tripId: TRIP,
        userId: OWNER,
        type: 'FLIGHT',
        provider: 'ANA',
        commissionAmount: 4200,
        commissionRate: 12,
        commissionPaid: true,
        commissionNotes: 'invoiced',
      },
    });

    const [ownerRow] = await getBookings(TRIP, OWNER);
    expect(ownerRow.commissionAmount).toBe(4200);

    const [friendRow] = await getBookings(TRIP, FRIEND);
    expect(friendRow.commissionAmount).toBeNull();
    expect(friendRow.commissionNotes).toBeNull();
    expect(friendRow.provider).toBe('ANA'); // the useful part survives
  });
});

describe('revocation', () => {
  it('unfriending revokes access immediately', async () => {
    await addCollaborator('EDITOR');
    expect(await statusOf(() => requireTripAccess(TRIP, FRIEND, 'view'))).toBe('ok');

    const friendship = (await prisma.friendship.findFirst({
      where: { requesterId: OWNER, addresseeId: FRIEND },
    }))!;
    await removeFriendship(OWNER, friendship.id);

    expect(await statusOf(() => requireTripAccess(TRIP, FRIEND, 'view'))).toBe(404);
    expect(await getTrips(FRIEND, 'minimal')).toEqual([]);
  });

  it('revokes even if the collaborator row is left behind', async () => {
    // The row cleanup inside removeFriendship is housekeeping. The per-request
    // friendship check is the actual boundary — prove it alone is sufficient by
    // deleting ONLY the friendship.
    await addCollaborator('EDITOR');
    await prisma.friendship.deleteMany({
      where: { OR: [{ requesterId: OWNER, addresseeId: FRIEND }, { requesterId: FRIEND, addresseeId: OWNER }] },
    });
    expect(
      await prisma.tripCollaborator.count({ where: { tripId: TRIP, status: 'ACCEPTED' } })
    ).toBe(1);
    expect(await statusOf(() => requireTripAccess(TRIP, FRIEND, 'view'))).toBe(404);
  });

  it('refuses an acceptance sent after the friendship ended', async () => {
    await inviteCollaborator(TRIP, OWNER, FRIEND, 'EDITOR');
    const [invite] = await listMyInvitations(FRIEND);
    const friendship = (await prisma.friendship.findFirst({
      where: { requesterId: OWNER, addresseeId: FRIEND },
    }))!;
    await prisma.friendship.delete({ where: { id: friendship.id } });

    expect(await statusOf(() => acceptInvitation(invite.id, FRIEND))).toBe(403);
    // ...and the dead invitation is cleared, not left to be accepted later.
    expect(await prisma.tripCollaborator.count({ where: { id: invite.id } })).toBe(0);
  });

  it('lets the owner remove a collaborator', async () => {
    await addCollaborator('EDITOR');
    await removeCollaborator(TRIP, OWNER, FRIEND);
    expect(await statusOf(() => requireTripAccess(TRIP, FRIEND, 'view'))).toBe(404);
  });

  it('lets a collaborator leave, and only their own membership', async () => {
    await addCollaborator('EDITOR');
    const { myRowId } = await listCollaborators(TRIP, FRIEND);
    expect(await statusOf(() => declineOrLeave(myRowId!, STRANGER))).toBe(403);
    await declineOrLeave(myRowId!, FRIEND);
    expect(await statusOf(() => requireTripAccess(TRIP, FRIEND, 'view'))).toBe(404);
  });
});

describe('strangers', () => {
  it('cannot tell an unshared trip from one that does not exist', async () => {
    // Both 404 — existence is never disclosed.
    expect(await statusOf(() => requireTripAccess(TRIP, STRANGER, 'view'))).toBe(404);
    expect(await statusOf(() => requireTripAccess('no-such-trip', STRANGER, 'view'))).toBe(404);
  });

  it('being friends is not itself access', async () => {
    // FRIEND is connected but has no invitation.
    expect(await statusOf(() => requireTripAccess(TRIP, FRIEND, 'view'))).toBe(404);
  });
});

describe('account deletion does not cross the trip boundary', () => {
  it("reattributes a departing collaborator's rows to the trip owner", async () => {
    await addCollaborator('EDITOR');
    const expense = await prisma.expense.create({
      data: { tripId: TRIP, userId: FRIEND, amount: 42, category: 'FOOD', date: new Date() },
    });

    await deleteAllUserData(FRIEND);

    const after = await prisma.expense.findUnique({ where: { id: expense.id } });
    expect(after, 'the row must survive — it is content on the owner\'s trip').not.toBeNull();
    expect(after!.userId).toBe(OWNER);
    expect(await prisma.trip.findUnique({ where: { id: TRIP } })).not.toBeNull();
    // The membership row goes with the account, via ON DELETE CASCADE.
    expect(await prisma.tripCollaborator.count({ where: { tripId: TRIP } })).toBe(0);
    expect(await prisma.user.findUnique({ where: { id: FRIEND } })).toBeNull();
  });

  it("still deletes the departing user's own trips and rows", async () => {
    const own = await prisma.trip.create({ data: { userId: FRIEND, title: 'Solo trip' } });
    await prisma.expense.create({
      data: { tripId: own.id, userId: FRIEND, amount: 10, category: 'FOOD', date: new Date() },
    });
    await deleteAllUserData(FRIEND);
    expect(await prisma.trip.findUnique({ where: { id: own.id } })).toBeNull();
    expect(await prisma.expense.count({ where: { tripId: own.id } })).toBe(0);
  });
});
