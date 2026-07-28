import { describe, it, expect } from 'vitest';
import {
  resolveTripCapability,
  satisfies,
  redactTripForViewer,
  redactBookingsForViewer,
  type ViewerRole,
  type TripCapability,
  type TripRoleValue,
  // Imported from the CORE, not from ./trip-access — the latter pulls in
  // @/lib/prisma, which throws at module scope without DB_PASSWORD and would
  // make this suite unrunnable. Keeping the decision logic prisma-free is what
  // makes the security-critical path testable at all.
} from './trip-access-core';

/**
 * The permission matrix, hammered exhaustively.
 *
 * These are pure functions precisely so this suite can exist: the rest of the
 * test suite never imports @/lib/prisma (it throws at module scope without
 * DB_PASSWORD), so the decision core was extracted specifically to make the
 * security-critical logic testable without a database.
 *
 * Every case below is a rule someone could plausibly "simplify" later and
 * thereby open a hole.
 */

const OWNER = 'user-owner';
const OTHER = 'user-other';

const CAPS: TripCapability[] = ['view', 'edit', 'owner'];

function roleFor(
  viewerId: string,
  collaborator: { role: TripRoleValue; status: 'PENDING' | 'ACCEPTED' } | null,
  friendshipAccepted: boolean
): ViewerRole | null {
  return resolveTripCapability({ ownerId: OWNER, viewerId, collaborator, friendshipAccepted });
}

describe('resolveTripCapability', () => {
  it('the owner is the owner, unconditionally', () => {
    // Not contingent on friendship: an owner who is friends with nobody still
    // owns their own trips.
    expect(roleFor(OWNER, null, false)).toBe('OWNER');
    expect(roleFor(OWNER, null, true)).toBe('OWNER');
    expect(roleFor(OWNER, { role: 'VIEWER', status: 'PENDING' }, false)).toBe('OWNER');
  });

  it('grants the row role to an accepted collaborator who is still a friend', () => {
    expect(roleFor(OTHER, { role: 'EDITOR', status: 'ACCEPTED' }, true)).toBe('EDITOR');
    expect(roleFor(OTHER, { role: 'VIEWER', status: 'ACCEPTED' }, true)).toBe('VIEWER');
  });

  it('a PENDING invitation is NOT access', () => {
    // An invitation the invitee has not accepted must grant literally nothing —
    // they get only the whitelisted preview from /api/collaborations.
    expect(roleFor(OTHER, { role: 'EDITOR', status: 'PENDING' }, true)).toBeNull();
    expect(roleFor(OTHER, { role: 'VIEWER', status: 'PENDING' }, true)).toBeNull();
  });

  it('REVOKES access when the friendship is gone, even for an ACCEPTED row', () => {
    // The load-bearing invariant. removeFriendship() deletes only the Friendship
    // row, so if this ever regresses an unfriended person keeps access to every
    // trip they were ever added to.
    expect(roleFor(OTHER, { role: 'EDITOR', status: 'ACCEPTED' }, false)).toBeNull();
    expect(roleFor(OTHER, { role: 'VIEWER', status: 'ACCEPTED' }, false)).toBeNull();
  });

  it('grants nothing to a stranger with no row', () => {
    expect(roleFor(OTHER, null, false)).toBeNull();
    expect(roleFor(OTHER, null, true)).toBeNull(); // friendship alone is not access
  });
});

describe('satisfies', () => {
  it('OWNER satisfies every capability', () => {
    for (const need of CAPS) expect(satisfies('OWNER', need)).toBe(true);
  });

  it('EDITOR may view and edit but never owner-level acts', () => {
    expect(satisfies('EDITOR', 'view')).toBe(true);
    expect(satisfies('EDITOR', 'edit')).toBe(true);
    // deleteTrip, share-link publishing, collaborator management.
    expect(satisfies('EDITOR', 'owner')).toBe(false);
  });

  it('VIEWER may only view', () => {
    expect(satisfies('VIEWER', 'view')).toBe(true);
    expect(satisfies('VIEWER', 'edit')).toBe(false);
    expect(satisfies('VIEWER', 'owner')).toBe(false);
  });
});

describe('the full matrix', () => {
  // Exhaustive: every (relationship, friendship, capability) triple, asserted
  // against an explicit expectation table rather than recomputed logic.
  const CASES: Array<{
    name: string;
    viewer: string;
    collaborator: { role: TripRoleValue; status: 'PENDING' | 'ACCEPTED' } | null;
    friends: boolean;
    allow: TripCapability[];
  }> = [
    { name: 'owner', viewer: OWNER, collaborator: null, friends: false, allow: ['view', 'edit', 'owner'] },
    { name: 'editor + friend', viewer: OTHER, collaborator: { role: 'EDITOR', status: 'ACCEPTED' }, friends: true, allow: ['view', 'edit'] },
    { name: 'viewer + friend', viewer: OTHER, collaborator: { role: 'VIEWER', status: 'ACCEPTED' }, friends: true, allow: ['view'] },
    { name: 'editor, unfriended', viewer: OTHER, collaborator: { role: 'EDITOR', status: 'ACCEPTED' }, friends: false, allow: [] },
    { name: 'viewer, unfriended', viewer: OTHER, collaborator: { role: 'VIEWER', status: 'ACCEPTED' }, friends: false, allow: [] },
    { name: 'editor invite pending', viewer: OTHER, collaborator: { role: 'EDITOR', status: 'PENDING' }, friends: true, allow: [] },
    { name: 'viewer invite pending', viewer: OTHER, collaborator: { role: 'VIEWER', status: 'PENDING' }, friends: true, allow: [] },
    { name: 'stranger', viewer: OTHER, collaborator: null, friends: false, allow: [] },
    { name: 'friend with no invite', viewer: OTHER, collaborator: null, friends: true, allow: [] },
  ];

  for (const c of CASES) {
    for (const need of CAPS) {
      const expected = c.allow.includes(need);
      it(`${c.name} ${expected ? 'MAY' : 'may NOT'} ${need}`, () => {
        const role = roleFor(c.viewer, c.collaborator, c.friends);
        const granted = role !== null && satisfies(role, need);
        expect(granted).toBe(expected);
      });
    }
  }
});

describe('redactTripForViewer', () => {
  const trip = {
    id: 't1',
    title: 'Tokyo',
    budget: 5000,
    shareToken: 'secret-token',
    shareEnabled: true,
    shareExpiresAt: new Date('2030-01-01'),
    vendors: [{ vendor: { email: 'v@example.com', phone: '555' } }],
    clients: [{ client: { email: 'c@example.com', notes: 'private' } }],
    friends: [{ friend: { email: 'f@example.com' } }],
    itinerary: [{ id: 'i1', title: 'Flight', vendor: { email: 'v@example.com' }, client: null }],
    bookings: [{ id: 'b1', commissionAmount: 250, commissionRate: 10, commissionPaid: true, commissionNotes: 'n' }],
  };

  it('leaves the owner payload untouched', () => {
    const out = redactTripForViewer(trip, { isOwner: true, viewerRole: 'OWNER' });
    expect(out.shareToken).toBe('secret-token');
    expect(out.vendors).toHaveLength(1);
    expect(out.viewerRole).toBe('OWNER');
  });

  it('strips the share token so a collaborator cannot publish the trip', () => {
    const out = redactTripForViewer(trip, { isOwner: false, viewerRole: 'EDITOR' });
    expect('shareToken' in out).toBe(false);
    expect('shareEnabled' in out).toBe(false);
    expect('shareExpiresAt' in out).toBe(false);
  });

  it("empties the owner's address book", () => {
    const out = redactTripForViewer(trip, { isOwner: false, viewerRole: 'EDITOR' });
    expect(out.vendors).toEqual([]);
    expect(out.clients).toEqual([]);
    expect(out.friends).toEqual([]);
  });

  it('strips contact objects hanging off itinerary items', () => {
    const out = redactTripForViewer(trip, { isOwner: false, viewerRole: 'VIEWER' });
    const item = (out.itinerary as Record<string, unknown>[])[0];
    expect('vendor' in item).toBe(false);
    expect('client' in item).toBe(false);
    expect(item.title).toBe('Flight'); // the actual itinerary survives
  });

  it('nulls commission data on nested bookings', () => {
    const out = redactTripForViewer(trip, { isOwner: false, viewerRole: 'EDITOR' });
    const b = (out.bookings as Record<string, unknown>[])[0];
    expect(b.commissionAmount).toBeNull();
    expect(b.commissionRate).toBeNull();
    expect(b.commissionPaid).toBeNull();
    expect(b.commissionNotes).toBeNull();
    expect(b.id).toBe('b1');
  });

  it('does not mutate the input', () => {
    redactTripForViewer(trip, { isOwner: false, viewerRole: 'VIEWER' });
    expect(trip.shareToken).toBe('secret-token');
    expect(trip.vendors).toHaveLength(1);
  });

  /**
   * Key-set guard. If someone adds a new sensitive column to Trip, this fails
   * until they decide whether a collaborator may see it.
   */
  it('exposes exactly the expected keys to a non-owner', () => {
    const out = redactTripForViewer(trip, { isOwner: false, viewerRole: 'EDITOR' });
    expect(Object.keys(out).sort()).toEqual(
      ['bookings', 'budget', 'clients', 'friends', 'id', 'itinerary', 'title', 'vendors', 'viewerRole'].sort()
    );
  });
});

describe('redactBookingsForViewer', () => {
  const rows = [{ id: 'b1', vendorName: 'Hilton', commissionAmount: 100, commissionRate: 5, commissionPaid: false, commissionNotes: 'x' }];

  it('leaves owner rows alone', () => {
    expect(redactBookingsForViewer(rows, { isOwner: true })[0].commissionAmount).toBe(100);
  });

  it('nulls every commission field for a collaborator', () => {
    const out = redactBookingsForViewer(rows, { isOwner: false })[0];
    expect(out.commissionAmount).toBeNull();
    expect(out.commissionRate).toBeNull();
    expect(out.commissionPaid).toBeNull();
    expect(out.commissionNotes).toBeNull();
    // Non-sensitive booking data must survive — the collaborator needs it.
    expect(out.vendorName).toBe('Hilton');
  });
});
