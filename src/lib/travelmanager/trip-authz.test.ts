import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * The authorization firewall.
 *
 * The permission matrix in trip-access.test.ts proves the *decision* is right.
 * This suite proves the decision is actually consulted — which is the failure
 * mode that shipped the bug this whole feature had to work around: one rule,
 * fifteen independent implementations (seven copied `verifyTripOwnership`
 * helpers plus eight inline ownership checks written straight into route
 * handlers). A refactor that widens some and misses others produces a
 * half-working permission surface, which is worse than none because it reads as
 * deliberate.
 *
 * These are static source checks. They cannot prove authorization is *correct*,
 * only that it is present and centralised — but that is exactly the class of
 * regression code review keeps missing.
 */

const ROOT = path.resolve(__dirname, '../../..');
const API_DIR = path.join(ROOT, 'src', 'app', 'api');
const LIB_DIR = path.join(ROOT, 'src', 'lib', 'travelmanager');

function walk(dir: string, filter: (f: string) => boolean): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return walk(full, filter);
    return filter(full) ? [full] : [];
  });
}

const rel = (f: string) => path.relative(ROOT, f);
const read = (f: string) => fs.readFileSync(f, 'utf8');

describe('trip authorization is centralised', () => {
  it('no file re-implements the ownership check inline', () => {
    // `prisma.trip.findFirst/findUnique` whose where-clause also mentions userId
    // IS an ownership check. Only trip-access.ts may make that decision.
    const pattern = /prisma\.trip\.find(?:First|Unique)\s*\(\s*\{[\s\S]{0,200}?where:\s*\{[^}]*userId/;
    const files = [
      ...walk(API_DIR, (f) => f.endsWith('.ts')),
      ...walk(LIB_DIR, (f) => f.endsWith('.ts') && !f.endsWith('.test.ts')),
      // The chokepoint itself, and its core — the latter only *describes* the
      // banned pattern in a comment explaining why it exists.
    ].filter((f) => !f.endsWith('trip-access.ts') && !f.endsWith('trip-access-core.ts'));

    const offenders = files.filter((f) => pattern.test(read(f))).map(rel);
    expect(
      offenders,
      `These files decide trip ownership themselves instead of calling\n` +
        `requireTripAccess(). That is how a permission change lands in some paths\n` +
        `and not others. Route the check through @/lib/travelmanager/trip-access.\n` +
        offenders.map((o) => `  ${o}`).join('\n')
    ).toEqual([]);
  });

  it('the old duplicated predicate is gone and stays gone', () => {
    const offenders = walk(LIB_DIR, (f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
      .filter((f) => /function\s+verifyTripOwnership/.test(read(f)))
      .map(rel);
    expect(
      offenders,
      `verifyTripOwnership was copy-pasted into seven modules. It has been replaced\n` +
        `by requireTripAccess(); do not reintroduce a private copy.\n${offenders.join('\n')}`
    ).toEqual([]);
  });

  it('every trip-scoped route consults the chokepoint', () => {
    // Routes that legitimately do not authorize against a single trip.
    const ALLOWLIST: Record<string, string> = {
      'src/app/api/trips/route.ts': 'list + create; scoped by tripScopeWhere / creates a new trip',
      'src/app/api/trips/bulk-delete/route.ts':
        'deliberately owner-only via a userId filter — must never widen to collaborators',
      'src/app/api/trips/from-template/route.ts': 'creates a brand-new trip owned by the caller',
      // These delegate rather than authorize inline. Each named helper opens
      // with requireTripAccess(tripId, userId, 'owner') — verified, not assumed.
      // Contacts stay owner-only in v1, so 'owner' is the correct capability.
      'src/app/api/trips/[id]/vendors/route.ts': "getTripVendors / linkVendorToTrip require 'owner'",
      'src/app/api/trips/[id]/clients/route.ts': "getTripClients / linkClientToTrip require 'owner'",
      'src/app/api/trips/[id]/friends/route.ts': "getTripFriends / linkFriendToTrip require 'owner'",
      'src/app/api/trips/[id]/collaborators/route.ts':
        'listCollaborators / listInviteCandidates / inviteCollaborator authorize in collaborators.ts',
      'src/app/api/trips/[id]/collaborators/[userId]/route.ts':
        "setCollaboratorRole / removeCollaborator require 'owner' in collaborators.ts",
    };

    const tripRoutes = walk(path.join(API_DIR, 'trips'), (f) => f.endsWith('route.ts'));
    // The flat child endpoints carry no tripId in the URL, which is precisely
    // why they are the bypass risk: authorizing only /api/trips/[id]/* would
    // leave every update and delete the UI actually sends wide open.
    const childRoutes = [
      'itinerary/[id]', 'itinerary/reorder', 'stops/reorder', 'expenses/[id]',
      'expenses/[id]/receipt', 'checklists/[id]', 'notes/[id]', 'attachments/[id]',
      'bookings/[id]',
    ]
      .map((p) => path.join(API_DIR, p, 'route.ts'))
      .filter((f) => fs.existsSync(f));

    const offenders = [...tripRoutes, ...childRoutes]
      .filter((f) => !(rel(f) in ALLOWLIST))
      .filter((f) => !read(f).includes('requireTripAccess'))
      .map(rel);

    expect(
      offenders,
      `These routes touch a trip or one of its children but never call\n` +
        `requireTripAccess(). Either authorize them, or add them to ALLOWLIST\n` +
        `in this test with a written reason.\n${offenders.map((o) => `  ${o}`).join('\n')}`
    ).toEqual([]);
  });

  it('bulk-delete still filters by userId', () => {
    // Once shared trips appear in /api/trips, a collaborator could select the
    // owner's trip and bulk-delete it if this ever got "helpfully" widened.
    const f = path.join(API_DIR, 'trips', 'bulk-delete', 'route.ts');
    const src = read(f);
    // Nested braces are expected here — the real clause is
    // `where: { id: { in: ids }, userId: user.id }`.
    expect(src).toMatch(/where:\s*\{[\s\S]{0,120}?userId/);
  });

  it('routes that authorize also translate the error to its status', () => {
    // requireTripAccess throws TripAccessError carrying 403/404. A handler that
    // catches it only in the generic block returns 500, which hides a
    // permission denial behind what looks like a server fault.
    const offenders = walk(API_DIR, (f) => f.endsWith('route.ts'))
      .filter((f) => read(f).includes('requireTripAccess'))
      .filter((f) => !read(f).includes('TripAccessError'))
      .map(rel);
    expect(
      offenders,
      `These call requireTripAccess but never handle TripAccessError, so denials\n` +
        `surface as HTTP 500.\n${offenders.map((o) => `  ${o}`).join('\n')}`
    ).toEqual([]);
  });
});
