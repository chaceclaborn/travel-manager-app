#!/usr/bin/env node
/**
 * Two-account permission check for collaborative trips — run against a REAL
 * database, not the pure unit tests.
 *
 *   DATABASE_URL=postgresql://you@localhost:5432/travelmanager \
 *     npx tsx scripts/verify-collab-permissions.mjs
 *
 * Why this is a script and not a test: the Vitest suite is pure — nothing
 * imports @/lib/prisma, which throws at module scope without DB_PASSWORD — and
 * the Playwright E2E harness only has one credential pair, so neither can prove
 * "account B is actually denied on account A's trip". The unit tests prove the
 * DECISION is right; this proves the decision is wired to a real database
 * correctly, through requireTripAccess itself.
 *
 * Creates throwaway rows prefixed `vcp-` and removes them again, including on
 * failure. Safe against a dev database; do NOT point it at production.
 */
const W = new URL('..', import.meta.url).pathname;
const prisma = (await import(`${W}/src/lib/prisma.ts`)).default;
const { requireTripAccess } = await import(`${W}/src/lib/travelmanager/trip-access.ts`);
const { deleteAllUserData } = await import(`${W}/src/lib/travelmanager/trips.ts`);

const A = 'vcp-owner';
const B = 'vcp-collab';
const T = 'vcp-trip';
const results = [];
const check = (label, got, want) => results.push([label, got, want, got === want]);

async function cleanup() {
  await prisma.expense.deleteMany({ where: { tripId: T } });
  await prisma.tripCollaborator.deleteMany({ where: { tripId: T } });
  await prisma.trip.deleteMany({ where: { id: T } });
  await prisma.friendship.deleteMany({
    where: { OR: [{ requesterId: A }, { addresseeId: A }, { requesterId: B }, { addresseeId: B }] },
  });
  await prisma.user.deleteMany({ where: { id: { in: [A, B] } } });
}

async function probe(who, need) {
  try {
    return (await requireTripAccess(T, who, need)).viewerRole;
  } catch (e) {
    return String(e.status);
  }
}

try {
  await cleanup();
  await prisma.user.createMany({
    data: [
      { id: A, email: 'a@vcp.test', name: 'Owner' },
      { id: B, email: 'b@vcp.test', name: 'Collab' },
    ],
  });
  await prisma.trip.create({ data: { id: T, userId: A, title: 'Shared Trip' } });
  const friendship = await prisma.friendship.create({
    data: { requesterId: A, addresseeId: B, status: 'ACCEPTED' },
  });

  // An invitation is not access.
  const row = await prisma.tripCollaborator.create({
    data: { tripId: T, userId: B, invitedById: A, role: 'EDITOR', status: 'PENDING' },
  });
  check('PENDING invite cannot view', await probe(B, 'view'), '404');

  await prisma.tripCollaborator.update({ where: { id: row.id }, data: { status: 'ACCEPTED' } });
  check('EDITOR can view', await probe(B, 'view'), 'EDITOR');
  check('EDITOR can edit', await probe(B, 'edit'), 'EDITOR');
  check('EDITOR denied owner acts', await probe(B, 'owner'), '403');

  await prisma.tripCollaborator.update({ where: { id: row.id }, data: { role: 'VIEWER' } });
  check('VIEWER can view', await probe(B, 'view'), 'VIEWER');
  check('VIEWER denied edit', await probe(B, 'edit'), '403');

  // The invariant everything else leans on: the collaborator row stays
  // ACCEPTED, only the friendship goes away.
  await prisma.tripCollaborator.update({ where: { id: row.id }, data: { role: 'EDITOR' } });
  check('access before unfriend', await probe(B, 'view'), 'EDITOR');
  await prisma.friendship.delete({ where: { id: friendship.id } });
  check('UNFRIEND REVOKES ACCESS', await probe(B, 'view'), '404');

  check('owner unaffected', await probe(A, 'owner'), 'OWNER');

  // Account deletion must not reach across the trip boundary.
  await prisma.friendship.create({ data: { requesterId: A, addresseeId: B, status: 'ACCEPTED' } });
  await prisma.tripCollaborator.upsert({
    where: { tripId_userId: { tripId: T, userId: B } },
    update: { status: 'ACCEPTED' },
    create: { tripId: T, userId: B, invitedById: A, role: 'EDITOR', status: 'ACCEPTED' },
  });
  const expense = await prisma.expense.create({
    data: { tripId: T, userId: B, amount: 42, category: 'FOOD', description: 'lunch', date: new Date() },
  });
  await deleteAllUserData(B);
  const after = await prisma.expense.findUnique({ where: { id: expense.id } });
  check('authored row survives B deleting their account', !!after, true);
  check('...and reattributes to the trip owner', after?.userId, A);
  check("...and the owner's trip is intact", !!(await prisma.trip.findUnique({ where: { id: T } })), true);
} finally {
  await cleanup();
  await prisma.$disconnect();
}

const pad = (s, n) => String(s).padEnd(n);
console.log(`\n  ${pad('CASE', 44)}${pad('GOT', 10)}WANT`);
for (const [label, got, want, ok] of results) {
  console.log(`  ${ok ? 'PASS' : 'FAIL'} ${pad(label, 40)}${pad(got, 10)}${want}`);
}
const allPass = results.every((r) => r[3]);
console.log(allPass ? '\n  All permission invariants hold.\n' : '\n  FAILURES PRESENT\n');
process.exit(allPass ? 0 : 1);
