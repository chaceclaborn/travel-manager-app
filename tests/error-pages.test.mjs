/**
 * Error Handling Tests — Travel Manager
 *
 * Tests error pages, 404 handling, JSON error responses,
 * and graceful handling of invalid request bodies.
 *
 * Run: node tests/error-pages.test.mjs
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

// ─── Non-Existent Pages Return 404 ───

async function testNonExistentPagesReturn404() {
  console.log('\n  Non-Existent Pages Return 404\n');

  const pages = [
    { path: '/this-page-does-not-exist',           label: 'Random non-existent path' },
    { path: '/api/this-route-does-not-exist',       label: 'Non-existent API route' },
    { path: '/dashboard/fake-section',              label: 'Non-existent dashboard section' },
  ];

  for (const page of pages) {
    try {
      const res = await fetch(`${BASE_URL}${page.path}`);

      report(
        `${page.label} (${page.path}) returns 404`,
        res.status === 404,
        `Got status ${res.status}`
      );
    } catch (err) {
      report(`${page.label} is reachable`, false, `Fetch failed: ${err.message}`);
    }
  }
}

// ─── API Endpoints Return JSON Errors (Not HTML) ───

async function testApiEndpointsReturnJsonErrors() {
  console.log('\n  API Endpoints Return JSON Errors (Not HTML)\n');

  const endpoints = [
    { method: 'GET',    path: '/api/trips',                     label: 'GET /api/trips (unauth)' },
    { method: 'GET',    path: '/api/vendors',                   label: 'GET /api/vendors (unauth)' },
    { method: 'GET',    path: '/api/clients',                   label: 'GET /api/clients (unauth)' },
    { method: 'GET',    path: '/api/documents',                 label: 'GET /api/documents (unauth)' },
    { method: 'GET',    path: '/api/dashboard',                 label: 'GET /api/dashboard (unauth)' },
    { method: 'GET',    path: '/api/analytics',                 label: 'GET /api/analytics (unauth)' },
    { method: 'GET',    path: '/api/user',                      label: 'GET /api/user (unauth)' },
    { method: 'GET',    path: '/api/user/sessions',             label: 'GET /api/user/sessions (unauth)' },
    { method: 'GET',    path: '/api/user/export',               label: 'GET /api/user/export (unauth)' },
    { method: 'DELETE', path: '/api/user/delete',               label: 'DELETE /api/user/delete (unauth)' },
    { method: 'GET',    path: `/api/bookings/${FAKE_ID}`,       label: 'GET /api/bookings/[id] (unauth)' },
    { method: 'PUT',    path: `/api/itinerary/${FAKE_ID}`,      label: 'PUT /api/itinerary/[id] (unauth)' },
  ];

  for (const ep of endpoints) {
    try {
      const res = await fetch(`${BASE_URL}${ep.path}`, {
        method: ep.method,
        headers: { 'Content-Type': 'application/json' },
      });

      const contentType = res.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');

      // Also try to parse the body as JSON
      const body = await res.json().catch(() => null);
      const hasErrorField = body && typeof body.error === 'string';

      report(
        `${ep.label} returns JSON with error field`,
        isJson && hasErrorField,
        `content-type=${contentType}, body=${JSON.stringify(body)}`
      );
    } catch (err) {
      report(`${ep.label} returns JSON`, false, `Fetch failed: ${err.message}`);
    }
  }
}

// ─── API Routes Handle Invalid JSON Body Gracefully ───

async function testInvalidJsonBodyHandling() {
  console.log('\n  API Routes Handle Invalid JSON Body Gracefully\n');

  const endpoints = [
    { path: '/api/trips',    label: 'POST /api/trips' },
    { path: '/api/vendors',  label: 'POST /api/vendors' },
    { path: '/api/clients',  label: 'POST /api/clients' },
  ];

  for (const ep of endpoints) {
    try {
      // Send malformed JSON
      const res = await fetch(`${BASE_URL}${ep.path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{this is not valid json!!!',
      });

      const notServerError = res.status !== 500 && res.status !== 502 && res.status !== 503;
      report(
        `${ep.label} with invalid JSON does not return 5xx`,
        notServerError,
        `Got status ${res.status}`
      );
    } catch (err) {
      report(`${ep.label} with invalid JSON`, false, `Fetch failed: ${err.message}`);
    }
  }

  // Also test with completely wrong content type
  for (const ep of endpoints) {
    try {
      const res = await fetch(`${BASE_URL}${ep.path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: 'just a plain string',
      });

      const notServerError = res.status !== 500 && res.status !== 502 && res.status !== 503;
      report(
        `${ep.label} with text/plain body does not return 5xx`,
        notServerError,
        `Got status ${res.status}`
      );
    } catch (err) {
      report(`${ep.label} with text/plain body`, false, `Fetch failed: ${err.message}`);
    }
  }
}

// ─── API Routes Reject Unsupported HTTP Methods ───

async function testUnsupportedMethods() {
  console.log('\n  API Routes Handle Unsupported HTTP Methods\n');

  const tests = [
    { method: 'PATCH',  path: '/api/trips',    label: 'PATCH /api/trips' },
    { method: 'PATCH',  path: '/api/vendors',   label: 'PATCH /api/vendors' },
    { method: 'PATCH',  path: '/api/dashboard', label: 'PATCH /api/dashboard' },
  ];

  for (const test of tests) {
    try {
      const res = await fetch(`${BASE_URL}${test.path}`, {
        method: test.method,
        headers: { 'Content-Type': 'application/json' },
      });

      // Should return 405 Method Not Allowed or at least not 5xx
      const notServerError = res.status !== 500 && res.status !== 502 && res.status !== 503;
      report(
        `${test.label} does not return 5xx`,
        notServerError,
        `Got status ${res.status}`
      );
    } catch (err) {
      report(`${test.label} is reachable`, false, `Fetch failed: ${err.message}`);
    }
  }
}

// ─── Run ───

async function main() {
  console.log(`\nError Handling Tests — Travel Manager`);
  console.log(`Target: ${BASE_URL}`);

  console.log('\n--- Automated Tests ---');

  await testNonExistentPagesReturn404();
  await testApiEndpointsReturnJsonErrors();
  await testInvalidJsonBodyHandling();
  await testUnsupportedMethods();

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
