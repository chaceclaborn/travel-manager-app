/**
 * THE authorization chokepoint for trips.
 *
 * Before this existed the rule "you own this trip" was implemented as seven
 * byte-identical private copies of `verifyTripOwnership` across the data layer,
 * plus eight more inline `prisma.trip.findFirst({ where: { id, userId } })`
 * checks written directly in route handlers. Fifteen independent enforcement
 * points for one predicate. Adding collaborators to some and missing others is
 * precisely how a permission feature half-works — and half-working permissions
 * are worse than none, because they read as intentional.
 *
 * So: every trip-touching path calls requireTripAccess() and nothing else.
 * src/lib/travelmanager/trip-authz.test.ts fails CI if an inline ownership
 * check reappears anywhere outside this file.
 *
 * Three capabilities, not a boolean — the old predicate gated reads, edits,
 * deleteTrip and enableTripShare identically, so a naive "owner OR collaborator"
 * widening would have let a read-only collaborator delete the trip or publish it
 * to the open internet.
 */

/** What a caller is trying to do. */
export type TripCapability = 'view' | 'edit' | 'owner';

/** What the caller is to this trip. */
export type ViewerRole = 'OWNER' | 'EDITOR' | 'VIEWER';

export const TRIP_ROLE_VALUES = ['VIEWER', 'EDITOR'] as const;
export type TripRoleValue = (typeof TRIP_ROLE_VALUES)[number];

/**
 * Carries an HTTP status the route handlers translate directly.
 *
 * 404 vs 403 is a disclosure decision, not cosmetics: **existence is never
 * revealed**. 403 is only ever returned once the caller has already proven a
 * relationship to the trip, so they know it exists anyway. Everything else —
 * no row, pending invite, revoked friendship, no such trip — is a flat 404.
 *
 * This also fixes a pre-existing bug: the old helpers threw a bare
 * `Error('Trip not found')` into generic catch blocks, so cross-tenant attempts
 * returned 500 on roughly twenty route/method pairs.
 */
export class TripAccessError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'TripAccessError';
    this.status = status;
  }
}

export interface TripAccess {
  tripId: string;
  ownerId: string;
  viewerRole: ViewerRole;
  isOwner: boolean;
}

/** Does this role satisfy the requested capability? */
export function satisfies(role: ViewerRole, need: TripCapability): boolean {
  if (role === 'OWNER') return true;
  if (role === 'EDITOR') return need === 'view' || need === 'edit';
  return need === 'view';
}

/**
 * The pure decision core — no database, so the capability matrix can be
 * exhaustively table-tested. `requireTripAccess` is the thin DB wrapper around
 * this.
 *
 * Returns the caller's effective role, or null for no access at all.
 */
export function resolveTripCapability(input: {
  ownerId: string;
  viewerId: string;
  collaborator: { role: TripRoleValue; status: 'PENDING' | 'ACCEPTED' } | null;
  /** Whether a live ACCEPTED Friendship exists between viewer and owner. */
  friendshipAccepted: boolean;
}): ViewerRole | null {
  // Ownership is unconditional. An owner who is not (or no longer) friends with
  // anyone still owns their own trip.
  if (input.ownerId === input.viewerId) return 'OWNER';

  const c = input.collaborator;
  if (!c) return null;

  // An invitation is not access. A PENDING row grants nothing at all — the
  // invitee sees only the whitelisted preview served by /api/collaborations.
  if (c.status !== 'ACCEPTED') return null;

  // The friendship is a CONTINUING precondition. removeFriendship() deletes only
  // the Friendship row, so without this re-check an unfriended collaborator
  // would keep full access to every trip they were ever added to.
  if (!input.friendshipAccepted) return null;

  return c.role === 'EDITOR' ? 'EDITOR' : 'VIEWER';
}

/**
 * Fields a non-owner must never receive.
 *
 * These reads use `include` with no `select`, so the FULL row is serialized to
 * whoever asked. That was harmless while the only possible reader was the owner;
 * the moment a second person can read a trip it becomes cross-account exposure.
 * Redaction is applied at the data layer, not the route, so a new route cannot
 * forget it.
 */
const OWNER_ONLY_TRIP_FIELDS = ['shareToken', 'shareEnabled', 'shareExpiresAt'] as const;
const OWNER_ONLY_BOOKING_FIELDS = [
  'commissionAmount',
  'commissionRate',
  'commissionPaid',
  'commissionNotes',
] as const;

/**
 * Strip owner-only data from a trip payload and stamp the viewer's role.
 *
 * - share fields: a collaborator holding the share token could publish a
 *   permanent unauthenticated link to a trip they do not own.
 * - vendors/clients/friends: these hydrate as FULL contact rows — email, phone,
 *   address, private notes — i.e. the owner's address book. Contacts stay
 *   owner-only in v1.
 * - itinerary vendor/client objects: same PII by another route.
 */
export function redactTripForViewer<T extends Record<string, unknown>>(
  trip: T,
  access: Pick<TripAccess, 'isOwner' | 'viewerRole'>
): T & { viewerRole: ViewerRole } {
  if (access.isOwner) return { ...trip, viewerRole: access.viewerRole };

  const out: Record<string, unknown> = { ...trip };
  for (const f of OWNER_ONLY_TRIP_FIELDS) delete out[f];
  if ('vendors' in out) out.vendors = [];
  if ('clients' in out) out.clients = [];
  if ('friends' in out) out.friends = [];
  if (Array.isArray(out.itinerary)) {
    out.itinerary = (out.itinerary as Record<string, unknown>[]).map((item) => {
      const copy = { ...item };
      delete copy.vendor;
      delete copy.client;
      return copy;
    });
  }
  if (Array.isArray(out.bookings)) {
    out.bookings = redactBookingsForViewer(out.bookings as Record<string, unknown>[], access);
  }
  return { ...(out as T), viewerRole: access.viewerRole };
}

/** Null the commission columns for non-owners. */
export function redactBookingsForViewer<T extends Record<string, unknown>>(
  rows: T[],
  access: Pick<TripAccess, 'isOwner'>
): T[] {
  if (access.isOwner) return rows;
  return rows.map((row) => {
    const copy: Record<string, unknown> = { ...row };
    for (const f of OWNER_ONLY_BOOKING_FIELDS) {
      if (f in copy) copy[f] = null;
    }
    return copy as T;
  });
}

/** Single booking variant of {@link redactBookingsForViewer}. */
export function redactBookingForViewer<T extends Record<string, unknown>>(
  row: T,
  access: Pick<TripAccess, 'isOwner'>
): T {
  return redactBookingsForViewer([row], access)[0];
}
