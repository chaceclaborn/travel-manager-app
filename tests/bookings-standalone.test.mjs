/**
 * Standalone Bookings API Tests — Travel Manager
 *
 * Tests the standalone bookings endpoints (not under a trip)
 * for auth enforcement and route availability.
 *
 * Run: node tests/bookings-standalone.test.mjs
 *
 * Requires: dev server running at http://localhost:3000
 */

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';
const FAKE_ID = 'nonexistent-id-00000';

let passed = 0;
let failed = 0;
const results = [];

function report(name, ok, detail) {
  const status = ok ? 'PASS' : 'FAIL';
  if (ok) passed++;
  else failed++;
  results.push({ name, status, detail });
  console.log(`  ${ok ? '\u2713' : '\u2717'} [${status}] ${name}${detail ? ' — ' + detail : ''}`);
}

// ─── Standalone Booking Endpoints Require Auth ───

async function testBookingEndpointsRequireAuth() {
  console.log('\n  Standalone Booking Endpoints Require Auth (401)\n');

  const endpoints = [
    // Standalone bookings list/create (new feature)
    { method: 'GET',    path: '/api/bookings',              label: 'List all bookings' },
    { method: 'POST',   path: '/api/bookings',              label: 'Create standalone booking' },

    // Individual booking CRUD
    { method: 'GET',    path: `/api/bookings/${FAKE_ID}`,   label: 'Get booking by ID' },
    { method: 'PUT',    path: `/api/bookings/${FAKE_ID}`,   label: 'Update booking by ID' },
    { method: 'DELETE', path: `/api/bookings/${FAKE_ID}`,   label: 'Delete booking by ID' },

    // Trip-scoped bookings
    { method: 'GET',    path: `/api/trips/${FAKE_ID}/bookings`,  label: 'List trip bookings' },
    { method: 'POST',   path: `/api/trips/${FAKE_ID}/bookings`,  label: 'Create trip booking' },
  ];

  for (const ep of endpoints) {
    try {
      const res = await fetch(`${BASE_URL}${ep.path}`, {
        method: ep.method,
        headers: { 'Content-Type': 'application/json' },
      });
      const body = await res.json().catch(() => null);

      const statusOk = res.status === 401;
      const bodyOk = body && body.error === 'Unauthorized';

      if (statusOk && bodyOk) {
        report(`${ep.label} returns 401 (${ep.method} ${ep.path})`, true);
      } else {
        const reasons = [];
        if (!statusOk) reasons.push(`status=${res.status} (expected 401)`);
        if (!bodyOk) reasons.push(`body=${JSON.stringify(body)}`);
        report(`${ep.label} returns 401 (${ep.method} ${ep.path})`, false, reasons.join(', '));
      }
    } catch (err) {
      report(`${ep.label} is reachable`, false, `Fetch failed: ${err.message}`);
    }
  }
}

// ─── Booking Routes Do Not Return 5xx ───

async function testBookingRoutesDoNotCrash() {
  console.log('\n  Booking Routes Do Not Return 5xx\n');

  const routes = [
    { method: 'GET',    path: '/api/bookings',              label: 'GET /api/bookings' },
    { method: 'GET',    path: `/api/bookings/${FAKE_ID}`,   label: 'GET /api/bookings/[id]' },
    { method: 'GET',    path: `/api/trips/${FAKE_ID}/bookings`, label: 'GET /api/trips/[id]/bookings' },
  ];

  for (const route of routes) {
    try {
      const res = await fetch(`${BASE_URL}${route.path}`, {
        method: route.method,
        headers: { 'Content-Type': 'application/json' },
      });

      const notServerError = res.status !== 500 && res.status !== 502 && res.status !== 503;
      report(
        `${route.label} does not return 5xx`,
        notServerError,
        `Got status ${res.status}`
      );
    } catch (err) {
      report(`${route.label} is reachable`, false, `Fetch failed: ${err.message}`);
    }
  }
}

// ─── POST Booking Without Auth Returns 401 (Not Validation Error) ───

async function testBookingPostValidation() {
  console.log('\n  POST Booking Validation (auth blocks first, expect 401)\n');

  const tests = [
    {
      label: 'POST /api/bookings with empty body returns 401',
      path: '/api/bookings',
      body: {},
      expectedStatus: 401,
    },
    {
      label: 'POST /api/bookings with partial data returns 401',
      path: '/api/bookings',
      body: { type: 'FLIGHT', provider: 'Delta' },
      expectedStatus: 401,
    },
    {
      label: 'POST /api/trips/[id]/bookings with empty body returns 401',
      path: `/api/trips/${FAKE_ID}/bookings`,
      body: {},
      expectedStatus: 401,
    },
  ];

  for (const test of tests) {
    try {
      const res = await fetch(`${BASE_URL}${test.path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(test.body),
      });

      report(
        test.label,
        res.status === test.expectedStatus,
        `Got status ${res.status}`
      );
    } catch (err) {
      report(test.label, false, `Fetch failed: ${err.message}`);
    }
  }
}

// ─── Booking Endpoints Return JSON ───

async function testBookingEndpointsReturnJson() {
  console.log('\n  Booking Endpoints Return JSON\n');

  const endpoints = [
    { method: 'GET',  path: '/api/bookings',              label: 'List bookings' },
    { method: 'GET',  path: `/api/bookings/${FAKE_ID}`,   label: 'Get booking' },
    { method: 'POST', path: `/api/trips/${FAKE_ID}/bookings`, label: 'Create trip booking' },
  ];

  for (const ep of endpoints) {
    try {
      const opts = {
        method: ep.method,
        headers: { 'Content-Type': 'application/json' },
      };
      if (ep.method === 'POST') {
        opts.body = JSON.stringify({});
      }

      const res = await fetch(`${BASE_URL}${ep.path}`, opts);
      const contentType = res.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');

      report(
        `${ep.label} returns JSON content-type`,
        isJson,
        `Got content-type: ${contentType}`
      );
    } catch (err) {
      report(`${ep.label} content-type check`, false, `Fetch failed: ${err.message}`);
    }
  }
}

// ─── Cancel / Status Update Endpoints Require Auth ───

async function testCancelBookingRequiresAuth() {
  console.log('\n  Cancel Booking Endpoints Require Auth (401)\n');

  const endpoints = [
    {
      label: 'PUT /api/bookings/[id] with status CANCELLED requires auth',
      method: 'PUT',
      path: `/api/bookings/${FAKE_ID}`,
      body: { status: 'CANCELLED' },
    },
    {
      label: 'PUT /api/bookings/[id] with status ACTIVE requires auth',
      method: 'PUT',
      path: `/api/bookings/${FAKE_ID}`,
      body: { status: 'ACTIVE' },
    },
  ];

  for (const ep of endpoints) {
    try {
      const res = await fetch(`${BASE_URL}${ep.path}`, {
        method: ep.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ep.body),
      });
      const body = await res.json().catch(() => null);

      const statusOk = res.status === 401;
      const bodyOk = body && body.error === 'Unauthorized';

      if (statusOk && bodyOk) {
        report(ep.label, true);
      } else {
        const reasons = [];
        if (!statusOk) reasons.push(`status=${res.status} (expected 401)`);
        if (!bodyOk) reasons.push(`body=${JSON.stringify(body)}`);
        report(ep.label, false, reasons.join(', '));
      }
    } catch (err) {
      report(ep.label, false, `Fetch failed: ${err.message}`);
    }
  }
}

// ─── Invalid Status Value Does Not Cause Server Error ───

async function testInvalidBookingStatusRejected() {
  console.log('\n  Invalid Booking Status Values Do Not Cause 5xx\n');

  // Auth runs before validation, so invalid status gets 401 without credentials.
  // This confirms the endpoint is reachable and auth-protected (not a 404 or 500).
  const invalidStatuses = ['PENDING', 'DELETED', '', 'cancelled', 'active'];

  for (const status of invalidStatuses) {
    try {
      const res = await fetch(`${BASE_URL}/api/bookings/${FAKE_ID}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      const notServerError = res.status !== 500 && res.status !== 502 && res.status !== 503;
      report(
        `PUT with status="${status}" does not cause 5xx`,
        notServerError,
        `Got status ${res.status}`
      );
    } catch (err) {
      report(`PUT with status="${status}" is reachable`, false, `Fetch failed: ${err.message}`);
    }
  }
}

// ─── Run ───

async function main() {
  console.log(`\nStandalone Bookings API Tests — Travel Manager`);
  console.log(`Target: ${BASE_URL}`);

  console.log('\n--- Automated Tests ---');

  await testBookingEndpointsRequireAuth();
  await testBookingRoutesDoNotCrash();
  await testBookingPostValidation();
  await testBookingEndpointsReturnJson();
  await testCancelBookingRequiresAuth();
  await testInvalidBookingStatusRejected();

  console.log('\n--- Summary ---');
  console.log(`  ${passed} passed, ${failed} failed out of ${passed + failed}`);

  if (failed > 0) {
    console.log('\nRESULT: SOME TESTS FAILED\n');
    process.exit(1);
  } else {
    console.log('\nRESULT: ALL TESTS PASSED\n');
  }
}

main().catch((err) => {
  console.error('Test runner error:', err);
  process.exit(1);
});
