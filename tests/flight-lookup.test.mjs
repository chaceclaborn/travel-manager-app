/**
 * Flight Lookup API Tests — Travel Manager
 *
 * Tests the /api/bookings/flight-lookup endpoint for auth enforcement,
 * input validation, and security (XSS).
 *
 * Run: node tests/flight-lookup.test.mjs
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

// ─── Auth Enforcement ───

async function testAuthEnforcement() {
  console.log('\n  Auth Enforcement — Flight Lookup\n');

  try {
    const res = await fetch(
      `${BASE_URL}/api/bookings/flight-lookup?flight=AA1234&date=2026-03-14`
    );
    const body = await res.json().catch(() => null);

    const statusOk = res.status === 401;
    const bodyOk = body && body.error === 'Unauthorized';

    report(
      'Valid flight lookup without auth returns 401',
      statusOk && bodyOk,
      `status=${res.status}, body=${JSON.stringify(body)}`
    );
  } catch (err) {
    report('Valid flight lookup without auth returns 401', false, `Fetch failed: ${err.message}`);
  }
}

// ─── Input Validation (all unauthenticated — expect 400 or 401) ───

async function testInputValidation() {
  console.log('\n  Input Validation (unauthenticated — expect 400 or 401)\n');

  const tests = [
    {
      label: 'Missing flight param returns 400 or 401',
      query: '?date=2026-03-14',
    },
    {
      label: 'Flight number too short (2 chars) returns 400 or 401',
      query: '?flight=AA&date=2026-03-14',
    },
    {
      label: 'Flight number too long (>10 chars) returns 400 or 401',
      query: '?flight=AA12345678901&date=2026-03-14',
    },
    {
      label: 'Invalid date format returns 400 or 401',
      query: '?flight=AA1234&date=not-a-date',
    },
    {
      label: 'No params at all returns 400 or 401',
      query: '',
    },
  ];

  for (const test of tests) {
    try {
      const res = await fetch(
        `${BASE_URL}/api/bookings/flight-lookup${test.query}`
      );

      // Auth check runs before validation, so 401 is acceptable.
      // If auth were skipped somehow, we'd expect 400.
      const ok = res.status === 400 || res.status === 401;
      report(test.label, ok, `Got status ${res.status}`);
    } catch (err) {
      report(test.label, false, `Fetch failed: ${err.message}`);
    }
  }
}

// ─── Response Content-Type ───

async function testResponseContentType() {
  console.log('\n  Response Content-Type\n');

  try {
    const res = await fetch(
      `${BASE_URL}/api/bookings/flight-lookup?flight=AA1234&date=2026-03-14`
    );

    const contentType = res.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');

    report(
      'Response has JSON content-type',
      isJson,
      `content-type: ${contentType}`
    );
  } catch (err) {
    report('Response has JSON content-type', false, `Fetch failed: ${err.message}`);
  }
}

// ─── XSS in Flight Param ───

async function testXssInFlightParam() {
  console.log('\n  XSS / Security\n');

  try {
    const res = await fetch(
      `${BASE_URL}/api/bookings/flight-lookup?flight=${encodeURIComponent('<script>alert(1)</script>')}&date=2026-03-14`
    );

    const ok = res.status === 400 || res.status === 401;
    const body = await res.text().catch(() => '');

    // Verify the raw script tag is NOT reflected back unescaped
    const noReflection = !body.includes('<script>');

    report(
      'XSS in flight param returns 400 or 401',
      ok,
      `Got status ${res.status}`
    );

    report(
      'XSS payload is not reflected in response body',
      noReflection,
      noReflection ? 'No raw <script> in body' : `Body contains <script>: ${body.substring(0, 200)}`
    );
  } catch (err) {
    report('XSS in flight param', false, `Fetch failed: ${err.message}`);
  }
}

// ─── Run ───

async function main() {
  console.log(`\nFlight Lookup API Tests — Travel Manager`);
  console.log(`Target: ${BASE_URL}`);

  console.log('\n--- Automated Tests ---');

  await testAuthEnforcement();
  await testInputValidation();
  await testResponseContentType();
  await testXssInFlightParam();

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
