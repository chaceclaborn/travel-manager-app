/**
 * Booking Detail Cancel Endpoint Tests — Travel Manager
 *
 * Tests that the PUT /api/bookings/:id endpoint enforces auth
 * and validates the status field (used by the detail-page cancel button).
 *
 * Run: node tests/booking-cancel-detail.test.mjs
 *
 * Requires: dev server running at http://localhost:3000
 */

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';
const FAKE_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

let passed = 0;
let failed = 0;
const results = [];

function report(name, ok, detail) {
  const status = ok ? 'PASS' : 'FAIL';
  if (ok) passed++;
  else failed++;
  results.push({ name, status, detail });
  console.log(`  ${ok ? '✓' : '✗'} [${status}] ${name}${detail ? ' — ' + detail : ''}`);
}

async function testCancelEndpointRequiresAuth() {
  console.log('\n  Cancel endpoint requires auth (401)\n');

  const res = await fetch(`${BASE_URL}/api/bookings/${FAKE_ID}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'CANCELLED' }),
  });
  const body = await res.json().catch(() => null);

  report(
    'PUT /api/bookings/:id with status=CANCELLED requires auth',
    res.status === 401 && body?.error === 'Unauthorized',
    `status=${res.status}`,
  );
}

async function testReactivateEndpointRequiresAuth() {
  console.log('\n  Reactivate endpoint requires auth (401)\n');

  const res = await fetch(`${BASE_URL}/api/bookings/${FAKE_ID}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'ACTIVE' }),
  });
  const body = await res.json().catch(() => null);

  report(
    'PUT /api/bookings/:id with status=ACTIVE requires auth',
    res.status === 401 && body?.error === 'Unauthorized',
    `status=${res.status}`,
  );
}

async function testInvalidStatusRejectedWithoutAuth() {
  console.log('\n  Invalid status still requires auth first\n');

  const res = await fetch(`${BASE_URL}/api/bookings/${FAKE_ID}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'PENDING' }),
  });

  // Auth check runs before status validation — expect 401, not 400
  report(
    'PUT with invalid status returns 401 (not 400) — auth runs first',
    res.status === 401,
    `status=${res.status}`,
  );
}

async function run() {
  console.log('=== Booking Detail Cancel Tests ===');
  await testCancelEndpointRequiresAuth();
  await testReactivateEndpointRequiresAuth();
  await testInvalidStatusRejectedWithoutAuth();

  console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error('Test runner error:', err);
  process.exit(1);
});
