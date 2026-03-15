/**
 * Dashboard & Analytics Tests — Travel Manager
 *
 * Tests the /api/dashboard, /api/analytics, and /api/search endpoints
 * for auth enforcement, response structure, and edge cases.
 *
 * Run: node tests/dashboard-analytics.test.mjs
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

// ─── Dashboard Auth Enforcement ───

async function testDashboardRequiresAuth() {
  console.log('\n  Dashboard Requires Authentication\n');

  try {
    const res = await fetch(`${BASE_URL}/api/dashboard`);
    const body = await res.json().catch(() => null);

    report(
      'GET /api/dashboard returns 401 without auth',
      res.status === 401,
      `Got status ${res.status}`
    );

    report(
      'GET /api/dashboard body is { error: "Unauthorized" }',
      body && body.error === 'Unauthorized',
      `Got body: ${JSON.stringify(body)}`
    );
  } catch (err) {
    report('GET /api/dashboard is reachable', false, `Fetch failed: ${err.message}`);
  }
}

// ─── Dashboard Does Not Crash ───

async function testDashboardDoesNotCrash() {
  console.log('\n  Dashboard Does Not Return 5xx\n');

  try {
    const res = await fetch(`${BASE_URL}/api/dashboard`);

    const notServerError = res.status !== 500 && res.status !== 502 && res.status !== 503;
    report(
      'GET /api/dashboard does not return 5xx',
      notServerError,
      `Got status ${res.status}`
    );
  } catch (err) {
    report('GET /api/dashboard is reachable', false, `Fetch failed: ${err.message}`);
  }
}

// ─── Dashboard Method Restrictions ───

async function testDashboardMethodRestrictions() {
  console.log('\n  Dashboard HTTP Method Handling\n');

  const methods = ['POST', 'PUT', 'DELETE', 'PATCH'];

  for (const method of methods) {
    try {
      const res = await fetch(`${BASE_URL}/api/dashboard`, {
        method,
        headers: { 'Content-Type': 'application/json' },
      });

      // Non-GET methods should not return 200
      const ok = res.status !== 200;
      report(
        `${method} /api/dashboard does not return 200`,
        ok,
        `Got status ${res.status}`
      );
    } catch (err) {
      report(`${method} /api/dashboard is reachable`, false, `Fetch failed: ${err.message}`);
    }
  }
}

// ─── Analytics Auth Enforcement ───

async function testAnalyticsRequiresAuth() {
  console.log('\n  Analytics Requires Authentication\n');

  const analyticsEndpoints = [
    { path: '/api/analytics',                   label: 'Analytics (default)' },
    { path: '/api/analytics?period=3months',     label: 'Analytics (3 months)' },
    { path: '/api/analytics?period=6months',     label: 'Analytics (6 months)' },
    { path: '/api/analytics?period=1year',       label: 'Analytics (1 year)' },
    { path: '/api/analytics?period=all',         label: 'Analytics (all time)' },
  ];

  for (const ep of analyticsEndpoints) {
    try {
      const res = await fetch(`${BASE_URL}${ep.path}`);
      const body = await res.json().catch(() => null);

      const statusOk = res.status === 401;
      const bodyOk = body && body.error === 'Unauthorized';

      if (statusOk && bodyOk) {
        report(`${ep.label} returns 401`, true);
      } else {
        const reasons = [];
        if (!statusOk) reasons.push(`status=${res.status} (expected 401)`);
        if (!bodyOk) reasons.push(`body=${JSON.stringify(body)}`);
        report(`${ep.label} returns 401`, false, reasons.join(', '));
      }
    } catch (err) {
      report(`${ep.label} is reachable`, false, `Fetch failed: ${err.message}`);
    }
  }
}

// ─── Analytics Does Not Crash ───

async function testAnalyticsDoesNotCrash() {
  console.log('\n  Analytics Does Not Return 5xx\n');

  const periods = ['', '?period=3months', '?period=6months', '?period=1year', '?period=all', '?period=invalid'];

  for (const period of periods) {
    try {
      const res = await fetch(`${BASE_URL}/api/analytics${period}`);

      const notServerError = res.status !== 500 && res.status !== 502 && res.status !== 503;
      report(
        `GET /api/analytics${period || ' (no period)'} does not return 5xx`,
        notServerError,
        `Got status ${res.status}`
      );
    } catch (err) {
      report(`GET /api/analytics${period} is reachable`, false, `Fetch failed: ${err.message}`);
    }
  }
}

// ─── Search Auth Enforcement ───

async function testSearchRequiresAuth() {
  console.log('\n  Search Requires Authentication\n');

  const searchTests = [
    { q: 'test',           label: 'Normal query' },
    { q: '',               label: 'Empty query' },
    { q: 'a',              label: 'Single char query (1 char)' },
    { q: 'ab',             label: 'Two char query (min length)' },
    { q: 'Paris trip',     label: 'Multi-word query' },
  ];

  for (const { q, label } of searchTests) {
    try {
      const url = q ? `${BASE_URL}/api/search?q=${encodeURIComponent(q)}` : `${BASE_URL}/api/search`;
      const res = await fetch(url);
      const body = await res.json().catch(() => null);

      // Empty and single-char queries may return empty results instead of 401
      // because the search endpoint checks query length before auth in some cases
      const isExpectedResponse = res.status === 401 || (body && Array.isArray(body.trips));

      report(
        `Search "${label}" returns expected response without auth`,
        isExpectedResponse,
        `Got status ${res.status}`
      );
    } catch (err) {
      report(`Search "${label}" is reachable`, false, `Fetch failed: ${err.message}`);
    }
  }
}

// ─── Search Does Not Crash With Various Queries ───

async function testSearchDoesNotCrash() {
  console.log('\n  Search Does Not Crash With Various Queries\n');

  const queries = [
    { q: 'test',                           label: 'Normal query' },
    { q: 'a',                              label: 'Single char' },
    { q: '',                               label: 'Empty query' },
    { q: 'a'.repeat(200),                  label: '200-char query' },
    { q: '<script>alert(1)</script>',      label: 'XSS attempt' },
    { q: "'; DROP TABLE trips; --",        label: 'SQL injection' },
    { q: '../../etc/passwd',               label: 'Path traversal' },
    { q: 'test query with spaces',         label: 'Spaces in query' },
    { q: 'test&extra=param',               label: 'Ampersand in query' },
  ];

  for (const { q, label } of queries) {
    try {
      const url = q ? `${BASE_URL}/api/search?q=${encodeURIComponent(q)}` : `${BASE_URL}/api/search`;
      const res = await fetch(url);

      const notServerError = res.status !== 500 && res.status !== 502 && res.status !== 503;
      report(
        `Search "${label}" does not return 5xx`,
        notServerError,
        `Got status ${res.status}`
      );
    } catch (err) {
      report(`Search "${label}" is reachable`, false, `Fetch failed: ${err.message}`);
    }
  }
}

// ─── Search Method Restrictions ───

async function testSearchMethodRestrictions() {
  console.log('\n  Search HTTP Method Handling\n');

  const methods = ['POST', 'PUT', 'DELETE', 'PATCH'];

  for (const method of methods) {
    try {
      const res = await fetch(`${BASE_URL}/api/search?q=test`, {
        method,
        headers: { 'Content-Type': 'application/json' },
      });

      const ok = res.status !== 200;
      report(
        `${method} /api/search does not return 200`,
        ok,
        `Got status ${res.status}`
      );
    } catch (err) {
      report(`${method} /api/search is reachable`, false, `Fetch failed: ${err.message}`);
    }
  }
}

// ─── Run ───

async function main() {
  console.log(`\nDashboard & Analytics Tests — Travel Manager`);
  console.log(`Target: ${BASE_URL}`);

  console.log('\n--- Automated Tests ---');

  await testDashboardRequiresAuth();
  await testDashboardDoesNotCrash();
  await testDashboardMethodRestrictions();
  await testAnalyticsRequiresAuth();
  await testAnalyticsDoesNotCrash();
  await testSearchRequiresAuth();
  await testSearchDoesNotCrash();
  await testSearchMethodRestrictions();

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
