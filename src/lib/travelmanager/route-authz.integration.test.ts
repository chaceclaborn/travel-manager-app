import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * The route × role authorization matrix.
 *
 * Every other suite tests a layer *below* the HTTP boundary. trip-access.test.ts
 * proves the decision; collaboration.integration.test.ts proves the service
 * layer applies it. Neither executes a route handler — so a route that passes
 * the wrong capability, forgets a guard, or swallows a TripAccessError into a
 * 500 passes all of them.
 *
 * That is not hypothetical. /api/bookings/bulk-delete shipped with no
 * authorization at all and every existing test stayed green, because nothing
 * called it. This suite calls it.
 *
 * The shape is deliberately a matrix rather than prose: each endpoint declares
 * what each role should get, and the table is the specification. Adding a
 * trip-touching route without adding a row here is caught by trip-authz.test.ts,
 * which fails on any route that never mentions requireTripAccess.
 *
 * `ok` means "not an authorization failure" — 2xx, or a 4xx that is clearly
 * about the request body rather than permission. We assert on the authorization
 * outcome, not on business responses.
 */

// ── Auth and rate limiting are stubbed; everything else is real ──────────────
// requireAuth reads cookies/headers via next/headers, which has no meaning
// outside a request scope. Rate limiting is an in-memory per-process Map that
// would throttle the matrix itself (invite POST is on the 5/min bucket).
let ACTOR: string | null = null;

vi.mock('@/lib/travelmanager/auth', async () => {
  const { NextResponse } = await import('next/server');
  return {
    requireAuth: async () =>
      ACTOR
        ? { user: { id: ACTOR, email: `${ACTOR}@it.test` }, response: null }
        : { user: null, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) },
  };
});

vi.mock('@/lib/rate-limit', () => ({ rateLimit: () => null }));

// Push would try to reach APNs. Delivery is not what this suite is about.
vi.mock('@/lib/push/dispatch', () => ({
  sendPushToUser: async () => ({ configured: false, targeted: 0, sent: 0, pruned: 0 }),
}));

const prisma = (await import('@/lib/prisma')).default;

const OWNER = 'ra-owner';
const EDITOR = 'ra-editor';
const VIEWER = 'ra-viewer';
const STRANGER = 'ra-stranger';
const ROLES = [OWNER, EDITOR, VIEWER, STRANGER] as const;
type Role = (typeof ROLES)[number];

// Ids must satisfy validateUUID (cuid shape: `c` + 20-30 [a-z0-9]). With
// arbitrary strings every route 400s on validation BEFORE authorization runs,
// which silently turns the whole matrix green for the wrong reason — the first
// version of this file did exactly that.
const cuid = (suffix: string) => `c${'authz'.repeat(4)}${suffix}`.slice(0, 25).padEnd(25, '0');
const TRIP = cuid('trip');
const ids = {
  itinerary: cuid('itin'),
  expense: cuid('expense'),
  checklist: cuid('check'),
  note: cuid('note'),
  booking: cuid('booking'),
  stop: cuid('stop'),
};

async function wipe() {
  await prisma.tripCollaborator.deleteMany({ where: { userId: { in: [...ROLES] } } });
  await prisma.expense.deleteMany({ where: { userId: { in: [...ROLES] } } });
  await prisma.booking.deleteMany({ where: { userId: { in: [...ROLES] } } });
  await prisma.checklistItem.deleteMany({ where: { userId: { in: [...ROLES] } } });
  await prisma.tripNote.deleteMany({ where: { userId: { in: [...ROLES] } } });
  await prisma.trip.deleteMany({ where: { userId: { in: [...ROLES] } } });
  await prisma.friendship.deleteMany({
    where: { OR: [{ requesterId: { in: [...ROLES] } }, { addresseeId: { in: [...ROLES] } }] },
  });
  await prisma.user.deleteMany({ where: { id: { in: [...ROLES] } } });
}

beforeAll(async () => {
  await wipe();
  await prisma.user.createMany({
    data: ROLES.map((id) => ({ id, email: `${id}@it.test`, name: id, username: id })),
  });
  await prisma.trip.create({
    data: {
      id: TRIP,
      userId: OWNER,
      title: 'Matrix Trip',
      shareToken: 'tok',
      startDate: new Date('2027-01-01'),
      endDate: new Date('2027-01-05'),
    },
  });
  for (const other of [EDITOR, VIEWER]) {
    await prisma.friendship.create({
      data: { requesterId: OWNER, addresseeId: other, status: 'ACCEPTED' },
    });
  }
  await prisma.tripCollaborator.createMany({
    data: [
      { tripId: TRIP, userId: EDITOR, invitedById: OWNER, role: 'EDITOR', status: 'ACCEPTED', acceptedAt: new Date() },
      { tripId: TRIP, userId: VIEWER, invitedById: OWNER, role: 'VIEWER', status: 'ACCEPTED', acceptedAt: new Date() },
    ],
  });
  // One child row of each kind, all authored by the OWNER.
  await prisma.itineraryItem.create({
    data: { id: ids.itinerary, tripId: TRIP, title: 'Flight', date: new Date('2027-01-01') },
  });
  await prisma.expense.create({
    data: { id: ids.expense, tripId: TRIP, userId: OWNER, amount: 10, category: 'FOOD', date: new Date() },
  });
  await prisma.checklistItem.create({
    data: { id: ids.checklist, tripId: TRIP, userId: OWNER, label: 'Pack' },
  });
  await prisma.tripNote.create({
    data: { id: ids.note, tripId: TRIP, userId: OWNER, content: 'Note', date: new Date('2027-01-02') },
  });
  await prisma.booking.create({
    data: { id: ids.booking, tripId: TRIP, userId: OWNER, type: 'FLIGHT', provider: 'ANA' },
  });
  await prisma.tripStop.create({
    data: { id: ids.stop, tripId: TRIP, name: 'Kyoto', latitude: 35.0, longitude: 135.8, sortOrder: 0 },
  });
});

afterAll(async () => {
  await wipe();
  await prisma.$disconnect();
});

/** What a role is allowed to see happen. */
type Expect = 'ok' | 403 | 404;

interface Case {
  name: string;
  /** Import the route module lazily so a broken import fails one case, not all. */
  load: () => Promise<Record<string, unknown>>;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  params?: Record<string, string>;
  body?: unknown;
  expect: Record<Role, Expect>;
  /** Skip mutations that would destroy the shared fixture. */
  readonlyProbe?: boolean;
}

const ALL_MAY_VIEW: Record<Role, Expect> = {
  [OWNER]: 'ok', [EDITOR]: 'ok', [VIEWER]: 'ok', [STRANGER]: 404,
};
const EDITORS_MAY_WRITE: Record<Role, Expect> = {
  [OWNER]: 'ok', [EDITOR]: 'ok', [VIEWER]: 403, [STRANGER]: 404,
};
const OWNER_ONLY: Record<Role, Expect> = {
  [OWNER]: 'ok', [EDITOR]: 403, [VIEWER]: 403, [STRANGER]: 404,
};

const CASES: Case[] = [
  // ── trip itself ───────────────────────────────────────────────────────────
  {
    name: 'GET /api/trips/[id]',
    load: () => import('@/app/api/trips/[id]/route'),
    method: 'GET', url: `/api/trips/${TRIP}`, params: { id: TRIP },
    expect: ALL_MAY_VIEW,
  },
  {
    name: 'PUT /api/trips/[id]',
    load: () => import('@/app/api/trips/[id]/route'),
    method: 'PUT', url: `/api/trips/${TRIP}`, params: { id: TRIP },
    body: { title: 'Matrix Trip' },
    expect: EDITORS_MAY_WRITE,
  },
  {
    name: 'GET /api/trips/[id]/share',
    load: () => import('@/app/api/trips/[id]/share/route'),
    method: 'GET', url: `/api/trips/${TRIP}/share`, params: { id: TRIP },
    expect: OWNER_ONLY,
  },
  {
    name: 'GET /api/trips/[id]/ical',
    load: () => import('@/app/api/trips/[id]/ical/route'),
    method: 'GET', url: `/api/trips/${TRIP}/ical`, params: { id: TRIP },
    expect: ALL_MAY_VIEW,
  },
  {
    name: 'GET /api/trips/[id]/report',
    load: () => import('@/app/api/trips/[id]/report/route'),
    method: 'GET', url: `/api/trips/${TRIP}/report`, params: { id: TRIP },
    expect: OWNER_ONLY,
  },
  {
    name: 'GET /api/trips/[id]/collaborators',
    load: () => import('@/app/api/trips/[id]/collaborators/route'),
    method: 'GET', url: `/api/trips/${TRIP}/collaborators`, params: { id: TRIP },
    expect: ALL_MAY_VIEW,
  },
  {
    name: 'POST /api/trips/[id]/collaborators (invite)',
    load: () => import('@/app/api/trips/[id]/collaborators/route'),
    method: 'POST', url: `/api/trips/${TRIP}/collaborators`, params: { id: TRIP },
    body: { userId: STRANGER, role: 'VIEWER' },
    // Owner is authorized but STRANGER is not a friend -> 403 from the
    // friendship precondition, which is still an authorization answer. What
    // matters here is that EDITOR/VIEWER never get to attempt it.
    expect: { [OWNER]: 403, [EDITOR]: 403, [VIEWER]: 403, [STRANGER]: 404 },
  },
  {
    name: 'GET /api/trips/[id]/vendors',
    load: () => import('@/app/api/trips/[id]/vendors/route'),
    method: 'GET', url: `/api/trips/${TRIP}/vendors`, params: { id: TRIP },
    expect: OWNER_ONLY,
  },

  // ── trip child collections ────────────────────────────────────────────────
  ...(['itinerary', 'stops', 'expenses', 'checklists', 'notes', 'bookings'] as const).map(
    (child): Case => ({
      name: `GET /api/trips/[id]/${child}`,
      load: () => import(`@/app/api/trips/[id]/${child}/route`),
      method: 'GET', url: `/api/trips/${TRIP}/${child}`, params: { id: TRIP },
      expect: ALL_MAY_VIEW,
    })
  ),

  // ── flat child routes: no tripId in the URL, so THE bypass surface ────────
  {
    name: 'PUT /api/itinerary/[id]',
    load: () => import('@/app/api/itinerary/[id]/route'),
    method: 'PUT', url: `/api/itinerary/${ids.itinerary}`, params: { id: ids.itinerary },
    body: { title: 'Flight', date: '2027-01-01' },
    expect: EDITORS_MAY_WRITE,
  },
  {
    name: 'PUT /api/expenses/[id]',
    load: () => import('@/app/api/expenses/[id]/route'),
    method: 'PUT', url: `/api/expenses/${ids.expense}`, params: { id: ids.expense },
    body: { amount: 10, category: 'FOOD', date: new Date().toISOString() },
    expect: EDITORS_MAY_WRITE,
  },
  {
    name: 'PUT /api/checklists/[id]',
    load: () => import('@/app/api/checklists/[id]/route'),
    method: 'PUT', url: `/api/checklists/${ids.checklist}`, params: { id: ids.checklist },
    body: { label: 'Pack' },
    expect: EDITORS_MAY_WRITE,
  },
  {
    name: 'PUT /api/notes/[id]',
    load: () => import('@/app/api/notes/[id]/route'),
    method: 'PUT', url: `/api/notes/${ids.note}`, params: { id: ids.note },
    body: { content: 'Note' },
    expect: EDITORS_MAY_WRITE,
  },
  {
    name: 'GET /api/bookings/[id]',
    load: () => import('@/app/api/bookings/[id]/route'),
    method: 'GET', url: `/api/bookings/${ids.booking}`, params: { id: ids.booking },
    expect: ALL_MAY_VIEW,
  },
  {
    name: 'PATCH /api/bookings/[id]',
    load: () => import('@/app/api/bookings/[id]/route'),
    method: 'PATCH', url: `/api/bookings/${ids.booking}`, params: { id: ids.booking },
    body: { provider: 'ANA' },
    expect: EDITORS_MAY_WRITE,
  },
];

function buildRequest(c: Case): NextRequest {
  const init: RequestInit = { method: c.method };
  if (c.body !== undefined) {
    init.body = JSON.stringify(c.body);
    init.headers = { 'Content-Type': 'application/json' };
  }
  return new NextRequest(`http://localhost${c.url}`, init as never);
}

async function callRoute(c: Case): Promise<number> {
  const mod = await c.load();
  const handler = mod[c.method] as (
    req: NextRequest,
    ctx: { params: Promise<Record<string, string>> }
  ) => Promise<Response>;
  if (typeof handler !== 'function') {
    throw new Error(`${c.name}: route exports no ${c.method} handler`);
  }
  const res = await handler(buildRequest(c), { params: Promise.resolve(c.params ?? {}) });
  return res.status;
}

/** Did the response represent an authorization failure, and which one? */
function classify(status: number): Expect | 'other' {
  if (status === 403) return 403;
  if (status === 404) return 404;
  if (status < 400) return 'ok';
  // Deliberately NOT treating 400 as success. Validation runs BEFORE
  // authorization in these handlers, so a 400 means the request never reached
  // the check under test — an allowed case that 400s is a false green, which is
  // precisely how the first version of this suite passed while testing nothing.
  return 'other';
}

describe('every trip route enforces the same permission model', () => {
  for (const c of CASES) {
    for (const role of ROLES) {
      const want = c.expect[role];
      const label = role.replace('ra-', '');
      it(`${c.name} — ${label} ${want === 'ok' ? 'allowed' : `gets ${want}`}`, async () => {
        ACTOR = role;
        const status = await callRoute(c);
        const got = classify(status);
        expect(
          got,
          `${c.name} as ${label}: expected ${want}, got HTTP ${status}. ` +
            (status >= 500
              ? 'A 5xx here means an authorization denial escaped as a server fault.'
              : '')
        ).toBe(want);
      });
    }
  }

  it('rejects unauthenticated callers on every route', async () => {
    ACTOR = null;
    for (const c of CASES) {
      const status = await callRoute(c);
      expect(status, `${c.name} must 401 when signed out`).toBe(401);
    }
  });
});

describe('the bulk-delete bypass stays closed', () => {
  // This one earned its own test. Booking.userId means AUTHOR, so a bare
  // `{ userId }` filter silently stopped being an ownership check when
  // collaboration landed — letting a removed collaborator hard-delete rows off
  // the owner's live trip. No other suite calls this route.
  it('will not let a collaborator bulk-delete their rows off the owner\'s trip', async () => {
    const authored = await prisma.booking.create({
      data: { tripId: TRIP, userId: EDITOR, type: 'HOTEL', provider: 'Hyatt' },
    });

    ACTOR = EDITOR;
    const mod = await import('@/app/api/bookings/bulk-delete/route');
    const res = await (mod.POST as (r: NextRequest) => Promise<Response>)(
      new NextRequest('http://localhost/api/bookings/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({ ids: [authored.id] }),
        headers: { 'Content-Type': 'application/json' },
      } as never)
    );
    const json = await res.json();

    expect(json.deleted, 'a booking on someone else\'s trip must not be bulk-deletable').toBe(0);
    expect(await prisma.booking.findUnique({ where: { id: authored.id } })).not.toBeNull();

    await prisma.booking.delete({ where: { id: authored.id } });
  });

  it('still lets someone bulk-delete bookings on their OWN trip', async () => {
    // The guard must not overshoot: this is the legitimate case.
    const own = await prisma.trip.create({ data: { userId: EDITOR, title: 'Own trip' } });
    const mine = await prisma.booking.create({
      data: { tripId: own.id, userId: EDITOR, type: 'HOTEL', provider: 'Own' },
    });
    const untethered = await prisma.booking.create({
      data: { userId: EDITOR, type: 'CAR_RENTAL', provider: 'Hertz' },
    });

    ACTOR = EDITOR;
    const mod = await import('@/app/api/bookings/bulk-delete/route');
    const res = await (mod.POST as (r: NextRequest) => Promise<Response>)(
      new NextRequest('http://localhost/api/bookings/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({ ids: [mine.id, untethered.id] }),
        headers: { 'Content-Type': 'application/json' },
      } as never)
    );
    expect((await res.json()).deleted).toBe(2);
    await prisma.trip.delete({ where: { id: own.id } });
  });
});
