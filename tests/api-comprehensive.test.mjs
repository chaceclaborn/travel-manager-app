/**
 * Comprehensive API Tests — Travel Manager
 *
 * Tests all CRUD endpoints for proper auth enforcement (401),
 * invalid ID handling, validation errors, and route availability.
 *
 * Run: node tests/api-comprehensive.test.mjs
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

// ─── All CRUD Endpoints Return 401 Without Auth ───

async function testAllCrudEndpointsReturn401() {
  console.log('\n  All CRUD Endpoints Return 401 Without Auth\n');

  const endpoints = [
    // Trips
    { method: 'GET',    path: '/api/trips',                           label: 'List trips' },
    { method: 'POST',   path: '/api/trips',                           label: 'Create trip' },
    { method: 'GET',    path: `/api/trips/${FAKE_ID}`,                label: 'Get trip' },
    { method: 'PUT',    path: `/api/trips/${FAKE_ID}`,                label: 'Update trip' },
    { method: 'DELETE', path: `/api/trips/${FAKE_ID}`,                label: 'Delete trip' },

    // Trip sub-resources
    { method: 'GET',    path: `/api/trips/${FAKE_ID}/vendors`,        label: 'List trip vendors' },
    { method: 'POST',   path: `/api/trips/${FAKE_ID}/vendors`,        label: 'Link vendor to trip' },
    { method: 'GET',    path: `/api/trips/${FAKE_ID}/clients`,        label: 'List trip clients' },
    { method: 'POST',   path: `/api/trips/${FAKE_ID}/clients`,        label: 'Link client to trip' },
    { method: 'GET',    path: `/api/trips/${FAKE_ID}/itinerary`,      label: 'List trip itinerary' },
    { method: 'POST',   path: `/api/trips/${FAKE_ID}/itinerary`,      label: 'Create itinerary item' },
    { method: 'GET',    path: `/api/trips/${FAKE_ID}/attachments`,    label: 'List trip attachments' },
    { method: 'POST',   path: `/api/trips/${FAKE_ID}/attachments`,    label: 'Upload attachment' },
    { method: 'GET',    path: `/api/trips/${FAKE_ID}/expenses`,       label: 'List trip expenses' },
    { method: 'POST',   path: `/api/trips/${FAKE_ID}/expenses`,       label: 'Create expense' },
    { method: 'GET',    path: `/api/trips/${FAKE_ID}/bookings`,       label: 'List trip bookings' },
    { method: 'POST',   path: `/api/trips/${FAKE_ID}/bookings`,       label: 'Create booking' },
    { method: 'GET',    path: `/api/trips/${FAKE_ID}/checklists`,     label: 'List trip checklists' },
    { method: 'POST',   path: `/api/trips/${FAKE_ID}/checklists`,     label: 'Create checklist item' },
    { method: 'GET',    path: `/api/trips/${FAKE_ID}/notes`,          label: 'List trip notes' },
    { method: 'POST',   path: `/api/trips/${FAKE_ID}/notes`,          label: 'Create note' },

    // Standalone entity routes
    { method: 'PUT',    path: `/api/itinerary/${FAKE_ID}`,            label: 'Update itinerary item' },
    { method: 'DELETE', path: `/api/itinerary/${FAKE_ID}`,            label: 'Delete itinerary item' },
    { method: 'GET',    path: `/api/attachments/${FAKE_ID}`,          label: 'Get attachment' },
    { method: 'DELETE', path: `/api/attachments/${FAKE_ID}`,          label: 'Delete attachment' },

    // Vendors
    { method: 'GET',    path: '/api/vendors',                         label: 'List vendors' },
    { method: 'POST',   path: '/api/vendors',                         label: 'Create vendor' },
    { method: 'GET',    path: `/api/vendors/${FAKE_ID}`,              label: 'Get vendor' },
    { method: 'PUT',    path: `/api/vendors/${FAKE_ID}`,              label: 'Update vendor' },
    { method: 'DELETE', path: `/api/vendors/${FAKE_ID}`,              label: 'Delete vendor' },

    // Clients
    { method: 'GET',    path: '/api/clients',                         label: 'List clients' },
    { method: 'POST',   path: '/api/clients',                         label: 'Create client' },
    { method: 'GET',    path: `/api/clients/${FAKE_ID}`,              label: 'Get client' },
    { method: 'PUT',    path: `/api/clients/${FAKE_ID}`,              label: 'Update client' },
    { method: 'DELETE', path: `/api/clients/${FAKE_ID}`,              label: 'Delete client' },

    // Documents
    { method: 'GET',    path: '/api/documents',                       label: 'List documents' },
    { method: 'POST',   path: '/api/documents',                       label: 'Create document' },
    { method: 'GET',    path: `/api/documents/${FAKE_ID}`,            label: 'Get document' },
    { method: 'PUT',    path: `/api/documents/${FAKE_ID}`,            label: 'Update document' },
    { method: 'DELETE', path: `/api/documents/${FAKE_ID}`,            label: 'Delete document' },

    // Dashboard, Analytics, Search
    { method: 'GET',    path: '/api/dashboard',                       label: 'Dashboard' },
    { method: 'GET',    path: '/api/analytics',                       label: 'Analytics' },
    { method: 'GET',    path: '/api/search?q=test',                   label: 'Search' },

    // User
    { method: 'GET',    path: '/api/user',                            label: 'Get user' },
    { method: 'GET',    path: '/api/user/export',                     label: 'Export user data' },
    { method: 'DELETE', path: '/api/user/delete',                     label: 'Delete user account' },
    { method: 'GET',    path: '/api/user/sessions',                   label: 'User sessions' },
    { method: 'GET',    path: '/api/user/summary?period=3months',     label: 'User summary' },
  ];

  for (const ep of endpoints) {
    try {
      const opts = {
        method: ep.method,
        headers: { 'Content-Type': 'application/json' },
      };

      const res = await fetch(`${BASE_URL}${ep.path}`, opts);
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

// ─── Major Routes Respond (Not 500) ───

async function testRoutesDoNotCrash() {
  console.log('\n  Major Routes Respond Without Server Error\n');

  const routes = [
    { method: 'GET', path: '/api/trips',            label: 'GET /api/trips' },
    { method: 'GET', path: '/api/vendors',           label: 'GET /api/vendors' },
    { method: 'GET', path: '/api/clients',           label: 'GET /api/clients' },
    { method: 'GET', path: '/api/documents',         label: 'GET /api/documents' },
    { method: 'GET', path: '/api/dashboard',         label: 'GET /api/dashboard' },
    { method: 'GET', path: '/api/analytics',         label: 'GET /api/analytics' },
    { method: 'GET', path: '/api/search?q=test',     label: 'GET /api/search' },
    { method: 'GET', path: '/api/user',              label: 'GET /api/user' },
    { method: 'GET', path: '/api/user/sessions',     label: 'GET /api/user/sessions' },
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

// ─── POST Validation ───

async function testPostValidation() {
  console.log('\n  POST Validation (auth blocks before validation, so expect 401)\n');

  const validationTests = [
    {
      label: 'POST /api/trips with missing title returns 401 (auth first)',
      path: '/api/trips',
      body: { destination: 'Paris' },
      expectedStatus: 401,
    },
    {
      label: 'POST /api/vendors with missing name returns 401 (auth first)',
      path: '/api/vendors',
      body: { category: 'HOTEL' },
      expectedStatus: 401,
    },
    {
      label: 'POST /api/clients with missing name returns 401 (auth first)',
      path: '/api/clients',
      body: { company: 'ACME' },
      expectedStatus: 401,
    },
    {
      label: 'POST /api/documents with missing type returns 401 (auth first)',
      path: '/api/documents',
      body: { label: 'My Passport' },
      expectedStatus: 401,
    },
    {
      label: 'POST /api/trips with empty body returns 401 (auth first)',
      path: '/api/trips',
      body: {},
      expectedStatus: 401,
    },
  ];

  for (const test of validationTests) {
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

// ─── Response Body Structure on 401 ───

async function testUnauthorizedResponseBody() {
  console.log('\n  Unauthorized Response Body Structure\n');

  const endpoints = [
    { path: '/api/trips', label: 'Trips' },
    { path: '/api/dashboard', label: 'Dashboard' },
    { path: '/api/analytics', label: 'Analytics' },
    { path: '/api/documents', label: 'Documents' },
  ];

  for (const ep of endpoints) {
    try {
      const res = await fetch(`${BASE_URL}${ep.path}`);
      const body = await res.json().catch(() => null);

      const hasErrorField = body && typeof body.error === 'string';
      const isUnauthorized = body && body.error === 'Unauthorized';

      report(
        `${ep.label} 401 response has { error: "Unauthorized" }`,
        hasErrorField && isUnauthorized,
        `Got body: ${JSON.stringify(body)}`
      );
    } catch (err) {
      report(`${ep.label} response body check`, false, `Fetch failed: ${err.message}`);
    }
  }
}

// ─── Run ───

async function main() {
  console.log(`\nComprehensive API Tests — Travel Manager`);
  console.log(`Target: ${BASE_URL}`);

  console.log('\n--- Automated Tests ---');

  await testAllCrudEndpointsReturn401();
  await testRoutesDoNotCrash();
  await testPostValidation();
  await testUnauthorizedResponseBody();

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
