/**
 * User Account API Tests — Travel Manager
 *
 * Tests all user-related endpoints for auth enforcement,
 * response structure, and route availability.
 *
 * Run: node tests/user-account.test.mjs
 *
 * Requires: dev server running at http://localhost:3000
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

// ─── All User Endpoints Require Auth (401) ───

async function testUserEndpointsRequireAuth() {
  console.log('\n  All User Endpoints Require Auth (401)\n');

  const endpoints = [
    { method: 'GET',    path: '/api/user',                          label: 'Get user profile' },
    { method: 'GET',    path: '/api/user/export',                   label: 'Export user data' },
    { method: 'DELETE', path: '/api/user/delete',                   label: 'Delete user account' },
    { method: 'GET',    path: '/api/user/sessions',                 label: 'Get user sessions' },
    { method: 'GET',    path: '/api/user/summary?period=3months',   label: 'Get user summary (3 months)' },
    { method: 'GET',    path: '/api/user/summary?period=6months',   label: 'Get user summary (6 months)' },
    { method: 'GET',    path: '/api/user/summary?period=1year',     label: 'Get user summary (1 year)' },
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

// ─── User Routes Do Not Return 5xx ───

async function testUserRoutesDoNotCrash() {
  console.log('\n  User Routes Do Not Return 5xx\n');

  const routes = [
    { method: 'GET',    path: '/api/user',                          label: 'GET /api/user' },
    { method: 'GET',    path: '/api/user/export',                   label: 'GET /api/user/export' },
    { method: 'GET',    path: '/api/user/sessions',                 label: 'GET /api/user/sessions' },
    { method: 'GET',    path: '/api/user/summary?period=3months',   label: 'GET /api/user/summary' },
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

// ─── User 401 Responses Have Correct Body Structure ───

async function testUser401ResponseBody() {
  console.log('\n  User 401 Responses Have Correct Body Structure\n');

  const endpoints = [
    { method: 'GET',    path: '/api/user',           label: 'User profile' },
    { method: 'GET',    path: '/api/user/export',    label: 'User export' },
    { method: 'DELETE', path: '/api/user/delete',    label: 'User delete' },
    { method: 'GET',    path: '/api/user/sessions',  label: 'User sessions' },
    { method: 'GET',    path: '/api/user/summary?period=3months', label: 'User summary' },
  ];

  for (const ep of endpoints) {
    try {
      const res = await fetch(`${BASE_URL}${ep.path}`, {
        method: ep.method,
        headers: { 'Content-Type': 'application/json' },
      });
      const body = await res.json().catch(() => null);

      const contentType = res.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');
      const hasErrorField = body && typeof body.error === 'string';
      const isUnauthorized = body && body.error === 'Unauthorized';

      report(
        `${ep.label} 401 response is JSON with { error: "Unauthorized" }`,
        isJson && hasErrorField && isUnauthorized,
        `content-type=${contentType}, body=${JSON.stringify(body)}`
      );
    } catch (err) {
      report(`${ep.label} response body check`, false, `Fetch failed: ${err.message}`);
    }
  }
}

// ─── User Endpoints Return JSON Content-Type ───

async function testUserEndpointsReturnJson() {
  console.log('\n  User Endpoints Return JSON Content-Type\n');

  const endpoints = [
    { method: 'GET',    path: '/api/user',           label: 'User profile' },
    { method: 'GET',    path: '/api/user/sessions',  label: 'User sessions' },
    { method: 'DELETE', path: '/api/user/delete',    label: 'User delete' },
  ];

  for (const ep of endpoints) {
    try {
      const res = await fetch(`${BASE_URL}${ep.path}`, {
        method: ep.method,
        headers: { 'Content-Type': 'application/json' },
      });

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

// ─── User Summary Rejects Invalid Period ───

async function testUserSummaryInvalidPeriod() {
  console.log('\n  User Summary Rejects Invalid Period (Auth First)\n');

  const tests = [
    { path: '/api/user/summary?period=invalid',   label: 'Invalid period param' },
    { path: '/api/user/summary?period=',           label: 'Empty period param' },
    { path: '/api/user/summary',                   label: 'No period param (defaults)' },
  ];

  for (const test of tests) {
    try {
      const res = await fetch(`${BASE_URL}${test.path}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      // Without auth, should get 401 before validation
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
  console.log(`\nUser Account API Tests — Travel Manager`);
  console.log(`Target: ${BASE_URL}`);

  console.log('\n--- Automated Tests ---');

  await testUserEndpointsRequireAuth();
  await testUserRoutesDoNotCrash();
  await testUser401ResponseBody();
  await testUserEndpointsReturnJson();
  await testUserSummaryInvalidPeriod();

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
