/**
 * Edge Case & Input Validation Tests — Travel Manager
 *
 * Tests malformed inputs, boundary values, query parameter edge cases,
 * Content-Type handling, response format consistency, and concurrent requests.
 *
 * Run: node tests/edge-cases-validation.test.mjs
 *
 * Requires: dev server running at http://localhost:3000
 *
 * Note: All API routes are auth-gated (requireAuth runs first), so
 * unauthenticated requests return 401 before body parsing in most cases.
 * When the body is malformed enough that Next.js cannot even parse the
 * request, it may return 400 or 500 instead. The key assertions are:
 *   - The server never crashes (no connection refused / no hanging)
 *   - Responses are always JSON with an `error` string field
 *   - Status codes are never in the 5xx range for input problems
 *     (unless the framework itself catches a parse error internally)
 */

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';

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

/**
 * Helper: send a raw POST request with an arbitrary string body and headers.
 * Returns { status, body (parsed JSON or null), contentType }.
 */
async function rawPost(path, rawBody, headers = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers,
    body: rawBody,
  });
  const contentType = res.headers.get('content-type') || '';
  let body = null;
  try {
    body = await res.json();
  } catch {
    // body stays null if response isn't valid JSON
  }
  return { status: res.status, body, contentType };
}

// ─────────────────────────────────────────────────────────
// 1. Invalid JSON Bodies (12 tests)
// ─────────────────────────────────────────────────────────

async function testInvalidJsonBodies() {
  console.log('\n  1. Invalid JSON Bodies\n');

  const cases = [
    {
      label: 'POST /api/trips — malformed JSON (missing closing brace)',
      path: '/api/trips',
      body: '{"title": "Test"',
      headers: { 'Content-Type': 'application/json' },
    },
    {
      label: 'POST /api/trips — empty body',
      path: '/api/trips',
      body: '',
      headers: { 'Content-Type': 'application/json' },
    },
    {
      label: 'POST /api/trips — body is literal "null"',
      path: '/api/trips',
      body: 'null',
      headers: { 'Content-Type': 'application/json' },
    },
    {
      label: 'POST /api/trips — body is JSON array instead of object',
      path: '/api/trips',
      body: '[1, 2, 3]',
      headers: { 'Content-Type': 'application/json' },
    },
    {
      label: 'POST /api/trips — body is empty string ""',
      path: '/api/trips',
      body: '""',
      headers: { 'Content-Type': 'application/json' },
    },
    {
      label: 'POST /api/trips — Content-Type: text/plain',
      path: '/api/trips',
      body: 'this is not json',
      headers: { 'Content-Type': 'text/plain' },
    },
    {
      label: 'POST /api/trips — extremely nested JSON (100 levels)',
      path: '/api/trips',
      body: '{' + '"a":'.repeat(100) + '1' + '}'.repeat(100),
      headers: { 'Content-Type': 'application/json' },
    },
    {
      label: 'POST /api/trips — unicode/emoji in title field',
      path: '/api/trips',
      body: JSON.stringify({ title: '\u{1F30D} Trip to T\u00f6ky\u00f6 \u2708\uFE0F \u2764\uFE0F\u200D\u{1F525}' }),
      headers: { 'Content-Type': 'application/json' },
    },
    {
      label: 'POST /api/vendors — malformed JSON',
      path: '/api/vendors',
      body: '{name: unquoted}',
      headers: { 'Content-Type': 'application/json' },
    },
    {
      label: 'POST /api/clients — body is "undefined"',
      path: '/api/clients',
      body: 'undefined',
      headers: { 'Content-Type': 'application/json' },
    },
    {
      label: 'POST /api/bookings — body is a number',
      path: '/api/bookings',
      body: '42',
      headers: { 'Content-Type': 'application/json' },
    },
    {
      label: 'POST /api/documents — body is boolean true',
      path: '/api/documents',
      body: 'true',
      headers: { 'Content-Type': 'application/json' },
    },
  ];

  for (const tc of cases) {
    try {
      const { status, body } = await rawPost(tc.path, tc.body, tc.headers);

      // Server must not crash: status should be 400, 401, or 500 (framework-level parse error).
      // It should NOT be 502/503 (server down) or hang indefinitely.
      const statusOk = [400, 401, 500].includes(status);
      // Response should ideally be JSON with an error field
      const hasError = body && typeof body.error === 'string';

      report(
        tc.label,
        statusOk && hasError,
        `status=${status}, error=${body?.error || '(none)'}`
      );
    } catch (err) {
      report(tc.label, false, `Fetch failed: ${err.message}`);
    }
  }
}

// ─────────────────────────────────────────────────────────
// 2. Boundary Values (12 tests)
// ─────────────────────────────────────────────────────────

async function testBoundaryValues() {
  console.log('\n  2. Boundary Values\n');

  const longString = 'A'.repeat(10000);
  const cases = [
    {
      label: 'POST /api/trips — title with 10,000 chars',
      path: '/api/trips',
      body: { title: longString },
    },
    {
      label: 'POST /api/vendors — name with 10,000 chars',
      path: '/api/vendors',
      body: { name: longString },
    },
    {
      label: 'POST /api/clients — name with 10,000 chars',
      path: '/api/clients',
      body: { name: longString },
    },
    {
      label: 'POST /api/trips — empty string title',
      path: '/api/trips',
      body: { title: '' },
    },
    {
      label: 'POST /api/trips — negative budget',
      path: '/api/trips',
      body: { title: 'Negative Budget Trip', budget: -9999 },
    },
    {
      label: 'POST /api/trips — zero budget',
      path: '/api/trips',
      body: { title: 'Zero Budget', budget: 0 },
    },
    {
      label: 'POST /api/trips — future date year 9999',
      path: '/api/trips',
      body: { title: 'Far Future', startDate: '9999-12-31', endDate: '9999-12-31' },
    },
    {
      label: 'POST /api/trips — past date year 1900',
      path: '/api/trips',
      body: { title: 'Ancient Trip', startDate: '1900-01-01', endDate: '1900-01-02' },
    },
    {
      label: 'POST /api/trips — special chars in title (quotes, backslashes)',
      path: '/api/trips',
      body: { title: 'Trip "with" \'quotes\' and \\backslashes\\ & <html>' },
    },
    {
      label: 'POST /api/trips — null byte in title',
      path: '/api/trips',
      body: { title: 'Trip with \u0000 null byte' },
    },
    {
      label: 'POST /api/vendors — special chars in all text fields',
      path: '/api/vendors',
      body: {
        name: 'Vendor "Special" <Corp>',
        email: 'test@test.com\'; DROP TABLE vendors;--',
        phone: '+1 (555) 000-0000 ext. 999',
        address: '123 O\'Malley St.\n"Suite" #5',
        notes: 'Notes with \ttabs, \nnewlines, and\r\nCRLF',
      },
    },
    {
      label: 'POST /api/trips — budget as string instead of number',
      path: '/api/trips',
      body: { title: 'String Budget', budget: 'not-a-number' },
    },
  ];

  for (const tc of cases) {
    try {
      const res = await fetch(`${BASE_URL}${tc.path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tc.body),
      });
      const body = await res.json().catch(() => null);

      // Auth gate returns 401; that's fine. The key is no 502/503 crash.
      const noCrash = res.status !== 502 && res.status !== 503;
      const isJson = body !== null;

      report(
        tc.label,
        noCrash && isJson,
        `status=${res.status}`
      );
    } catch (err) {
      report(tc.label, false, `Fetch failed: ${err.message}`);
    }
  }
}

// ─────────────────────────────────────────────────────────
// 3. Query Parameter Edge Cases (11 tests)
// ─────────────────────────────────────────────────────────

async function testQueryParameterEdgeCases() {
  console.log('\n  3. Query Parameter Edge Cases\n');

  const cases = [
    {
      label: '/api/search?q= (empty query)',
      path: '/api/search?q=',
    },
    {
      label: '/api/search?q=a (single char, too short)',
      path: '/api/search?q=a',
    },
    {
      label: '/api/search (missing q entirely)',
      path: '/api/search',
    },
    {
      label: '/api/analytics?period=invalid',
      path: '/api/analytics?period=invalid',
    },
    {
      label: '/api/documents?expiring=notaboolean',
      path: '/api/documents?expiring=notaboolean',
    },
    {
      label: '/api/documents?expiring=true (valid boolean)',
      path: '/api/documents?expiring=true',
    },
    {
      label: '/api/search?q=test&q=duplicate (duplicate param)',
      path: '/api/search?q=test&q=duplicate',
    },
    {
      label: '/api/search?q=%3Cscript%3Ealert(1)%3C/script%3E (XSS in query)',
      path: '/api/search?q=' + encodeURIComponent('<script>alert(1)</script>'),
    },
    {
      label: '/api/search?q=' + encodeURIComponent('SELECT * FROM trips') + ' (SQL in query)',
      path: '/api/search?q=' + encodeURIComponent('SELECT * FROM trips'),
    },
    {
      label: '/api/analytics?period=&extra=ignored (empty period + extra param)',
      path: '/api/analytics?period=&extra=ignored',
    },
    {
      label: '/api/search?q=' + encodeURIComponent('a'.repeat(5000)) + ' (very long query string)',
      path: '/api/search?q=' + encodeURIComponent('a'.repeat(5000)),
    },
  ];

  for (const tc of cases) {
    try {
      const res = await fetch(`${BASE_URL}${tc.path}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      const body = await res.json().catch(() => null);

      // All should return 401 (auth gate) or a valid JSON response
      const noCrash = res.status !== 502 && res.status !== 503 && res.status !== 500;
      const isJson = body !== null;

      report(
        tc.label,
        noCrash && isJson,
        `status=${res.status}`
      );
    } catch (err) {
      report(tc.label, false, `Fetch failed: ${err.message}`);
    }
  }
}

// ─────────────────────────────────────────────────────────
// 4. Content-Type Handling (8 tests)
// ─────────────────────────────────────────────────────────

async function testContentTypeHandling() {
  console.log('\n  4. Content-Type Handling\n');

  const validJsonBody = JSON.stringify({ title: 'Content-Type Test' });
  const cases = [
    {
      label: 'POST /api/trips — Content-Type: multipart/form-data',
      path: '/api/trips',
      body: validJsonBody,
      headers: { 'Content-Type': 'multipart/form-data' },
    },
    {
      label: 'POST /api/trips — Content-Type: application/xml',
      path: '/api/trips',
      body: '<trip><title>XML Trip</title></trip>',
      headers: { 'Content-Type': 'application/xml' },
    },
    {
      label: 'POST /api/trips — no Content-Type header at all',
      path: '/api/trips',
      body: validJsonBody,
      headers: {},
    },
    {
      label: 'POST /api/trips — Content-Type: text/html',
      path: '/api/trips',
      body: '<h1>Not JSON</h1>',
      headers: { 'Content-Type': 'text/html' },
    },
    {
      label: 'POST /api/vendors — Content-Type: application/x-www-form-urlencoded',
      path: '/api/vendors',
      body: 'name=Test+Vendor&category=HOTEL',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    },
    {
      label: 'POST /api/clients — Content-Type: application/json; charset=utf-8 (with charset)',
      path: '/api/clients',
      body: JSON.stringify({ name: 'Charset Client' }),
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    },
    {
      label: 'POST /api/bookings — Content-Type: APPLICATION/JSON (uppercase)',
      path: '/api/bookings',
      body: JSON.stringify({ provider: 'Test', type: 'FLIGHT' }),
      headers: { 'Content-Type': 'APPLICATION/JSON' },
    },
    {
      label: 'POST /api/documents — Content-Type: application/octet-stream',
      path: '/api/documents',
      body: validJsonBody,
      headers: { 'Content-Type': 'application/octet-stream' },
    },
  ];

  for (const tc of cases) {
    try {
      const { status, body } = await rawPost(tc.path, tc.body, tc.headers);

      // Server must respond (not crash). Auth gate should still fire for most.
      const noCrash = status !== 502 && status !== 503;
      // The response must be parseable (JSON or at least not an HTML error page)
      const hasJsonBody = body !== null;

      report(
        tc.label,
        noCrash && hasJsonBody,
        `status=${status}, error=${body?.error || '(none)'}`
      );
    } catch (err) {
      report(tc.label, false, `Fetch failed: ${err.message}`);
    }
  }
}

// ─────────────────────────────────────────────────────────
// 5. Response Format Validation (12 tests)
// ─────────────────────────────────────────────────────────

async function testResponseFormatValidation() {
  console.log('\n  5. Response Format Validation\n');

  // 5a: All 401 responses have { error: "Unauthorized" } and Content-Type: application/json
  const authEndpoints = [
    { method: 'GET',    path: '/api/trips',      label: 'GET /api/trips' },
    { method: 'POST',   path: '/api/trips',      label: 'POST /api/trips' },
    { method: 'GET',    path: '/api/vendors',     label: 'GET /api/vendors' },
    { method: 'POST',   path: '/api/vendors',     label: 'POST /api/vendors' },
    { method: 'GET',    path: '/api/clients',     label: 'GET /api/clients' },
    { method: 'GET',    path: '/api/documents',   label: 'GET /api/documents' },
    { method: 'GET',    path: '/api/bookings',    label: 'GET /api/bookings' },
    { method: 'GET',    path: '/api/dashboard',   label: 'GET /api/dashboard' },
    { method: 'GET',    path: '/api/analytics',   label: 'GET /api/analytics' },
    { method: 'GET',    path: '/api/search?q=test', label: 'GET /api/search' },
  ];

  for (const ep of authEndpoints) {
    try {
      const res = await fetch(`${BASE_URL}${ep.path}`, {
        method: ep.method,
        headers: { 'Content-Type': 'application/json' },
      });
      const body = await res.json().catch(() => null);
      const ct = res.headers.get('content-type') || '';

      const is401 = res.status === 401;
      const hasErrorUnauthorized = body && body.error === 'Unauthorized';
      const isJsonContentType = ct.includes('application/json');

      report(
        `${ep.label} — 401 with { error: "Unauthorized" } and JSON content-type`,
        is401 && hasErrorUnauthorized && isJsonContentType,
        `status=${res.status}, content-type=${ct}, body=${JSON.stringify(body)}`
      );
    } catch (err) {
      report(`${ep.label} — response format`, false, `Fetch failed: ${err.message}`);
    }
  }

  // 5b: 404 on non-existent routes returns a response (not crash)
  const notFoundPaths = [
    '/api/nonexistent',
    '/api/trips/fakeid/nonexistent',
  ];

  for (const path of notFoundPaths) {
    try {
      const res = await fetch(`${BASE_URL}${path}`, {
        headers: { 'Content-Type': 'application/json' },
      });

      // Next.js may return 404 (HTML) or 401 (if a catch-all matched the auth gate)
      const noCrash = res.status !== 502 && res.status !== 503;

      report(
        `GET ${path} — server responds without crash`,
        noCrash,
        `status=${res.status}`
      );
    } catch (err) {
      report(`GET ${path} — reachable`, false, `Fetch failed: ${err.message}`);
    }
  }
}

// ─────────────────────────────────────────────────────────
// 6. Concurrent Request Handling (6 tests)
// ─────────────────────────────────────────────────────────

async function testConcurrentRequests() {
  console.log('\n  6. Concurrent Request Handling\n');

  const concurrentEndpoints = [
    { method: 'GET', path: '/api/trips',      label: 'GET /api/trips' },
    { method: 'GET', path: '/api/vendors',     label: 'GET /api/vendors' },
    { method: 'GET', path: '/api/clients',     label: 'GET /api/clients' },
    { method: 'GET', path: '/api/dashboard',   label: 'GET /api/dashboard' },
    { method: 'GET', path: '/api/search?q=test', label: 'GET /api/search' },
    { method: 'POST', path: '/api/trips',      label: 'POST /api/trips' },
  ];

  for (const ep of concurrentEndpoints) {
    try {
      // Fire 10 simultaneous requests
      const promises = Array.from({ length: 10 }, () =>
        fetch(`${BASE_URL}${ep.path}`, {
          method: ep.method,
          headers: { 'Content-Type': 'application/json' },
          ...(ep.method === 'POST' ? { body: JSON.stringify({ title: 'Concurrent Test' }) } : {}),
        })
      );

      const responses = await Promise.all(promises);
      const statuses = responses.map((r) => r.status);

      // All should return the same status code (401 since no auth)
      const allSameStatus = statuses.every((s) => s === statuses[0]);
      // None should be 500/502/503
      const noServerErrors = statuses.every((s) => s !== 500 && s !== 502 && s !== 503);

      report(
        `${ep.label} — 10 concurrent requests all return same status, no 5xx`,
        allSameStatus && noServerErrors,
        `statuses=[${[...new Set(statuses)].join(',')}]`
      );
    } catch (err) {
      report(`${ep.label} — concurrent`, false, `Fetch failed: ${err.message}`);
    }
  }
}

// ─────────────────────────────────────────────────────────
// Run all test suites
// ─────────────────────────────────────────────────────────

async function main() {
  console.log(`\nEdge Case & Input Validation Tests — Travel Manager`);
  console.log(`Target: ${BASE_URL}\n`);

  await testInvalidJsonBodies();
  await testBoundaryValues();
  await testQueryParameterEdgeCases();
  await testContentTypeHandling();
  await testResponseFormatValidation();
  await testConcurrentRequests();

  console.log('\n--- Summary ---');
  console.log(`  ${passed} passed, ${failed} failed out of ${passed + failed} tests`);

  if (failed > 0) {
    console.log('\n  Failed tests:');
    for (const r of results) {
      if (r.status === 'FAIL') {
        console.log(`    - ${r.name}${r.detail ? ' — ' + r.detail : ''}`);
      }
    }
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
