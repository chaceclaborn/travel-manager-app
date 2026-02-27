/**
 * Auth Migration Tests — Travel Manager
 *
 * Tests the auth callback behavior and verifies that protected API routes
 * reject unauthenticated requests with 401.
 *
 * Run: node tests/auth-migration.test.mjs
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

// ─── Auth Callback Without Code ───

async function testCallbackWithoutCode() {
  console.log('\n  Auth Callback — Missing Code\n');

  try {
    const res = await fetch(`${BASE_URL}/auth/callback`, { redirect: 'manual' });

    const location = res.headers.get('location') || '';
    const isRedirect = res.status >= 300 && res.status < 400;
    // Missing code redirects to /tour?error=session_expired (no code means expired/missing session)
    const redirectsToError = location.includes('/tour?error=session_expired') || location.includes('/tour?error=auth');

    report(
      '/auth/callback without code returns redirect',
      isRedirect,
      `Got status ${res.status}`
    );

    report(
      '/auth/callback without code redirects to error page',
      redirectsToError,
      `Location: ${location}`
    );
  } catch (err) {
    report('/auth/callback without code is reachable', false, `Fetch failed: ${err.message}`);
  }
}

// ─── Auth Callback With Invalid Code ───

async function testCallbackWithInvalidCode() {
  console.log('\n  Auth Callback — Invalid Code\n');

  try {
    const res = await fetch(`${BASE_URL}/auth/callback?code=invalid-code-12345`, { redirect: 'manual' });

    const location = res.headers.get('location') || '';
    const isRedirect = res.status >= 300 && res.status < 400;
    const redirectsToError = location.includes('/tour?error=auth') || location.includes('/tour%3Ferror%3Dauth');

    report(
      '/auth/callback with invalid code returns redirect',
      isRedirect,
      `Got status ${res.status}`
    );

    report(
      '/auth/callback with invalid code redirects to /tour?error=auth',
      redirectsToError,
      `Location: ${location}`
    );
  } catch (err) {
    report('/auth/callback with invalid code is reachable', false, `Fetch failed: ${err.message}`);
  }
}

// ─── Protected API Routes Return 401 ───

async function testProtectedRoutesRequireAuth() {
  console.log('\n  Protected API Routes Require Authentication\n');

  const protectedEndpoints = [
    { method: 'GET',    path: '/api/trips',               label: 'List trips' },
    { method: 'POST',   path: '/api/trips',               label: 'Create trip' },
    { method: 'GET',    path: '/api/trips/fake-id',        label: 'Get trip by ID' },
    { method: 'PUT',    path: '/api/trips/fake-id',        label: 'Update trip' },
    { method: 'DELETE', path: '/api/trips/fake-id',        label: 'Delete trip' },
    { method: 'GET',    path: '/api/vendors',              label: 'List vendors' },
    { method: 'POST',   path: '/api/vendors',              label: 'Create vendor' },
    { method: 'GET',    path: '/api/clients',              label: 'List clients' },
    { method: 'POST',   path: '/api/clients',              label: 'Create client' },
    { method: 'GET',    path: '/api/dashboard',            label: 'Dashboard' },
    { method: 'GET',    path: '/api/documents',            label: 'List documents' },
    { method: 'POST',   path: '/api/documents',            label: 'Create document' },
    { method: 'GET',    path: '/api/analytics',            label: 'Analytics' },
    { method: 'GET',    path: '/api/search?q=test',        label: 'Search' },
    { method: 'GET',    path: '/api/user',                 label: 'Get user' },
    { method: 'GET',    path: '/api/user/export',          label: 'Export user data' },
    { method: 'GET',    path: '/api/user/sessions',        label: 'User sessions' },
  ];

  for (const ep of protectedEndpoints) {
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
        report(`${ep.label} requires auth (${ep.method} ${ep.path})`, true);
      } else {
        const reasons = [];
        if (!statusOk) reasons.push(`status=${res.status} (expected 401)`);
        if (!bodyOk) reasons.push(`body=${JSON.stringify(body)}`);
        report(`${ep.label} requires auth (${ep.method} ${ep.path})`, false, reasons.join(', '));
      }
    } catch (err) {
      report(`${ep.label} is reachable`, false, `Fetch failed: ${err.message}`);
    }
  }
}

// ─── Run ───

async function main() {
  console.log(`\nAuth Migration Tests — Travel Manager`);
  console.log(`Target: ${BASE_URL}`);

  console.log('\n--- Automated Tests ---');

  await testCallbackWithoutCode();
  await testCallbackWithInvalidCode();
  await testProtectedRoutesRequireAuth();

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
