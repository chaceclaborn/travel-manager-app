/**
 * Map & Geocode API Tests — Travel Manager
 *
 * Tests the map/geocode endpoints for auth enforcement,
 * query parameter validation, and route availability.
 *
 * Run: node tests/map-api.test.mjs
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

// ─── Geocode Search Requires Auth ───

async function testGeocodeSearchAuth() {
  console.log('\n  Geocode Search Requires Auth\n');

  const endpoints = [
    { method: 'GET', path: '/api/geocode/search',          label: 'Geocode search (no query)' },
    { method: 'GET', path: '/api/geocode/search?q=Paris',   label: 'Geocode search (with query)' },
    { method: 'GET', path: '/api/geocode/search?q=Lo',      label: 'Geocode search (short query)' },
    { method: 'GET', path: '/api/geocode/search?q=New+York', label: 'Geocode search (encoded query)' },
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

// ─── Trip Geocode Requires Auth ───

async function testTripGeocodeAuth() {
  console.log('\n  Trip Geocode Requires Auth\n');

  try {
    const res = await fetch(`${BASE_URL}/api/trips/${FAKE_ID}/geocode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const body = await res.json().catch(() => null);

    const statusOk = res.status === 401;
    const bodyOk = body && body.error === 'Unauthorized';

    if (statusOk && bodyOk) {
      report('POST /api/trips/[id]/geocode returns 401', true);
    } else {
      const reasons = [];
      if (!statusOk) reasons.push(`status=${res.status} (expected 401)`);
      if (!bodyOk) reasons.push(`body=${JSON.stringify(body)}`);
      report('POST /api/trips/[id]/geocode returns 401', false, reasons.join(', '));
    }
  } catch (err) {
    report('POST /api/trips/[id]/geocode is reachable', false, `Fetch failed: ${err.message}`);
  }
}

// ─── Geocode Routes Do Not Return 5xx ───

async function testGeocodeRoutesDoNotCrash() {
  console.log('\n  Geocode Routes Do Not Return 5xx\n');

  const routes = [
    { method: 'GET',  path: '/api/geocode/search',              label: 'GET /api/geocode/search' },
    { method: 'GET',  path: '/api/geocode/search?q=Paris',       label: 'GET /api/geocode/search?q=Paris' },
    { method: 'POST', path: `/api/trips/${FAKE_ID}/geocode`,     label: 'POST /api/trips/[id]/geocode' },
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

// ─── Geocode Returns JSON (Not HTML) ───

async function testGeocodeReturnsJson() {
  console.log('\n  Geocode Endpoints Return JSON\n');

  const endpoints = [
    { method: 'GET',  path: '/api/geocode/search',          label: 'Geocode search' },
    { method: 'POST', path: `/api/trips/${FAKE_ID}/geocode`, label: 'Trip geocode' },
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

// ─── Run ───

async function main() {
  console.log(`\nMap & Geocode API Tests — Travel Manager`);
  console.log(`Target: ${BASE_URL}`);

  console.log('\n--- Automated Tests ---');

  await testGeocodeSearchAuth();
  await testTripGeocodeAuth();
  await testGeocodeRoutesDoNotCrash();
  await testGeocodeReturnsJson();

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
