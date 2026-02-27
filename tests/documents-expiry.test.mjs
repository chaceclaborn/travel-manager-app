/**
 * Documents & Expiry Tests — Travel Manager
 *
 * Tests the /api/documents endpoint for auth enforcement,
 * proper response structure, and the ?expiring=true filter.
 *
 * Run: node tests/documents-expiry.test.mjs
 *
 * Requires: dev server running at http://localhost:3000
 */

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';
const FAKE_ID = 'nonexistent-doc-00000';

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

// ─── Documents Auth Enforcement ───

async function testDocumentsRequireAuth() {
  console.log('\n  Documents Endpoints Require Authentication\n');

  const endpoints = [
    { method: 'GET',    path: '/api/documents',                  label: 'List documents' },
    { method: 'POST',   path: '/api/documents',                  label: 'Create document' },
    { method: 'GET',    path: `/api/documents/${FAKE_ID}`,       label: 'Get document by ID' },
    { method: 'PUT',    path: `/api/documents/${FAKE_ID}`,       label: 'Update document' },
    { method: 'DELETE', path: `/api/documents/${FAKE_ID}`,       label: 'Delete document' },
    { method: 'GET',    path: '/api/documents?expiring=true',    label: 'Get expiring documents' },
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

// ─── Documents Endpoints Do Not Crash ───

async function testDocumentsDoNotCrash() {
  console.log('\n  Documents Endpoints Do Not Return 5xx\n');

  const routes = [
    { method: 'GET',  path: '/api/documents',                label: 'GET /api/documents' },
    { method: 'GET',  path: '/api/documents?expiring=true',  label: 'GET /api/documents?expiring=true' },
    { method: 'GET',  path: `/api/documents/${FAKE_ID}`,     label: 'GET /api/documents/:id (fake)' },
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

// ─── Documents POST Validation ───

async function testDocumentsPostValidation() {
  console.log('\n  Documents POST Validation (auth blocks first)\n');

  const tests = [
    {
      label: 'POST /api/documents with empty body returns 401',
      body: {},
      expectedStatus: 401,
    },
    {
      label: 'POST /api/documents with only type returns 401',
      body: { type: 'PASSPORT' },
      expectedStatus: 401,
    },
    {
      label: 'POST /api/documents with only label returns 401',
      body: { label: 'My Passport' },
      expectedStatus: 401,
    },
  ];

  for (const test of tests) {
    try {
      const res = await fetch(`${BASE_URL}/api/documents`, {
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

// ─── HTTP Method Restrictions ───

async function testDocumentsMethodRestrictions() {
  console.log('\n  Documents HTTP Method Handling\n');

  const methods = ['PUT', 'DELETE', 'PATCH'];

  for (const method of methods) {
    try {
      const res = await fetch(`${BASE_URL}/api/documents`, {
        method,
        headers: { 'Content-Type': 'application/json' },
      });

      // PUT/DELETE/PATCH on the collection endpoint should not return 200
      const ok = res.status !== 200;
      report(
        `${method} /api/documents does not return 200`,
        ok,
        `Got status ${res.status}`
      );
    } catch (err) {
      report(`${method} /api/documents is reachable`, false, `Fetch failed: ${err.message}`);
    }
  }
}

// ─── Expiring Query Parameter Variations ───

async function testExpiringQueryVariations() {
  console.log('\n  Expiring Query Parameter Variations\n');

  const variations = [
    { query: '?expiring=true',   label: 'expiring=true' },
    { query: '?expiring=false',  label: 'expiring=false' },
    { query: '?expiring=',       label: 'expiring= (empty)' },
    { query: '?expiring=yes',    label: 'expiring=yes (non-boolean)' },
  ];

  for (const v of variations) {
    try {
      const res = await fetch(`${BASE_URL}/api/documents${v.query}`, {
        headers: { 'Content-Type': 'application/json' },
      });

      // All should return 401 since we're not authenticated
      report(
        `GET /api/documents${v.query} returns 401`,
        res.status === 401,
        `Got status ${res.status}`
      );
    } catch (err) {
      report(`GET /api/documents${v.query} is reachable`, false, `Fetch failed: ${err.message}`);
    }
  }
}

// ─── Run ───

async function main() {
  console.log(`\nDocuments & Expiry Tests — Travel Manager`);
  console.log(`Target: ${BASE_URL}`);

  console.log('\n--- Automated Tests ---');

  await testDocumentsRequireAuth();
  await testDocumentsDoNotCrash();
  await testDocumentsPostValidation();
  await testDocumentsMethodRestrictions();
  await testExpiringQueryVariations();

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
