/**
 * Search Tests — Travel Manager
 *
 * Tests the /api/travelmanager/search endpoint for auth requirements,
 * edge cases (empty query, short query, special characters), and
 * documents authenticated search behavior.
 *
 * Run: node tests/travelmanager/search.test.mjs
 *
 * Requires: dev server running at http://localhost:3000
 */

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';
const SEARCH_ENDPOINT = `${BASE_URL}/api/travelmanager/search`;

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

// ─── Auth Requirement ───

async function testSearchRequiresAuth() {
  console.log('\n  Authentication\n');

  const queries = [
    { q: 'test', label: 'Normal query' },
    { q: '', label: 'Empty query' },
    { q: 'a', label: 'Single char query' },
    { q: 'Paris trip 2026', label: 'Multi-word query' },
  ];

  for (const { q, label } of queries) {
    try {
      const url = q ? `${SEARCH_ENDPOINT}?q=${encodeURIComponent(q)}` : SEARCH_ENDPOINT;
      const res = await fetch(url);
      const body = await res.json().catch(() => null);

      report(
        `Search with "${label}" returns 401 without auth`,
        res.status === 401,
        `Got status ${res.status}`
      );

      if (res.status === 401) {
        report(
          `Search "${label}" body is { error: "Unauthorized" }`,
          body && body.error === 'Unauthorized',
          `Got body: ${JSON.stringify(body)}`
        );
      }
    } catch (err) {
      report(`Search "${label}" is reachable`, false, `Fetch failed: ${err.message}`);
    }
  }
}

// ─── Special Characters Don't Crash ───

async function testSpecialCharacterQueries() {
  console.log('\n  Special Characters in Query\n');

  const specialQueries = [
    { q: '<script>alert(1)</script>', label: 'XSS script tag' },
    { q: "'; DROP TABLE trips; --", label: 'SQL injection attempt' },
    { q: '../../etc/passwd', label: 'Path traversal' },
    { q: '%00%0a%0d', label: 'Null bytes and CRLF' },
    { q: '🌍✈️🏨', label: 'Unicode emoji' },
    { q: '   ', label: 'Whitespace only' },
    { q: 'a'.repeat(500), label: '500-char query' },
    { q: 'test&foo=bar', label: 'Ampersand in query' },
    { q: 'test"query', label: 'Double quotes in query' },
  ];

  for (const { q, label } of specialQueries) {
    try {
      const url = `${SEARCH_ENDPOINT}?q=${encodeURIComponent(q)}`;
      const res = await fetch(url);

      // Should return 401 (auth check happens before query processing)
      // The important thing is it doesn't crash (500) or hang
      const isNotServerError = res.status !== 500 && res.status !== 502 && res.status !== 503;
      report(
        `Special chars "${label}" does not crash server`,
        isNotServerError,
        `Got status ${res.status}`
      );
    } catch (err) {
      report(`Special chars "${label}" does not hang`, false, `Fetch failed: ${err.message}`);
    }
  }
}

// ─── Search Endpoint Responds to GET Only ───

async function testSearchMethodRestrictions() {
  console.log('\n  HTTP Method Handling\n');

  const methods = ['POST', 'PUT', 'DELETE', 'PATCH'];

  for (const method of methods) {
    try {
      const res = await fetch(`${SEARCH_ENDPOINT}?q=test`, {
        method,
        headers: { 'Content-Type': 'application/json' },
      });

      // Non-GET methods should return 405 (Method Not Allowed) from Next.js
      // or 401 (if auth check runs first), but NOT 200
      const ok = res.status !== 200;
      report(
        `${method} /api/travelmanager/search does not return 200`,
        ok,
        `Got status ${res.status}`
      );
    } catch (err) {
      report(`${method} search is reachable`, false, `Fetch failed: ${err.message}`);
    }
  }
}

// ─── Documented Manual Tests ───

function documentManualTests() {
  console.log('\n--- Documented Test Cases (require auth to automate) ---\n');

  const manualTests = [
    {
      name: 'Empty query returns empty result arrays',
      description: 'GET /api/travelmanager/search (no q param) or GET /api/travelmanager/search?q=',
      expected: '{ trips: [], vendors: [], clients: [] }',
      codeRef: 'src/app/api/travelmanager/search/route.ts:10-12 — returns empty if !q or q.length < 2',
    },
    {
      name: 'Single character query returns empty results',
      description: 'GET /api/travelmanager/search?q=a',
      expected: '{ trips: [], vendors: [], clients: [] } — query must be at least 2 characters',
      codeRef: 'src/app/api/travelmanager/search/route.ts:10 — q.length < 2 check',
    },
    {
      name: 'Search for trip title returns matching trips',
      description: 'Create a trip titled "Paris Vacation", then GET /api/travelmanager/search?q=paris',
      expected: 'trips array contains the trip. Search is case-insensitive.',
      codeRef: 'src/lib/travelmanager/trips.ts:180 — title contains query, mode insensitive',
    },
    {
      name: 'Search for trip destination returns matching trips',
      description: 'Create a trip with destination "Tokyo", then GET /api/travelmanager/search?q=tokyo',
      expected: 'trips array contains the trip.',
      codeRef: 'src/lib/travelmanager/trips.ts:180 — destination contains query, mode insensitive',
    },
    {
      name: 'Search for vendor name returns matching vendors',
      description: 'Create a vendor named "Grand Hotel", then GET /api/travelmanager/search?q=grand',
      expected: 'vendors array contains the vendor.',
      codeRef: 'src/lib/travelmanager/trips.ts:185 — name contains query, mode insensitive',
    },
    {
      name: 'Search for vendor city returns matching vendors',
      description: 'Create a vendor with city "London", then GET /api/travelmanager/search?q=london',
      expected: 'vendors array contains the vendor.',
      codeRef: 'src/lib/travelmanager/trips.ts:185 — city contains query, mode insensitive',
    },
    {
      name: 'Search for client name returns matching clients',
      description: 'Create a client named "Alice Smith", then GET /api/travelmanager/search?q=alice',
      expected: 'clients array contains the client.',
      codeRef: 'src/lib/travelmanager/trips.ts:190 — name contains query, mode insensitive',
    },
    {
      name: 'Search for client company returns matching clients',
      description: 'Create a client with company "Acme Corp", then GET /api/travelmanager/search?q=acme',
      expected: 'clients array contains the client.',
      codeRef: 'src/lib/travelmanager/trips.ts:190 — company contains query, mode insensitive',
    },
    {
      name: 'Search results respect data isolation',
      description: 'User A creates a trip "Secret Trip". User B searches for "Secret".',
      expected: 'User B gets empty results — searchAll scopes by userId.',
      codeRef: 'src/lib/travelmanager/trips.ts:178 — searchAll(query, userId)',
    },
    {
      name: 'Search results limited to 5 per category',
      description: 'Create more than 5 trips matching "test", then search for "test".',
      expected: 'trips array has at most 5 items.',
      codeRef: 'src/lib/travelmanager/trips.ts:181 — take: 5',
    },
    {
      name: 'Search results sorted by updatedAt descending',
      description: 'Create multiple matching items with different update times.',
      expected: 'Results in each category are ordered by most recently updated first.',
      codeRef: 'src/lib/travelmanager/trips.ts:182,187,192 — orderBy: { updatedAt: "desc" }',
    },
    {
      name: 'Response shape: { trips, vendors, clients }',
      description: 'Any search query returns an object with exactly three keys.',
      expected: 'Object.keys(response) includes "trips", "vendors", "clients". Each is an array.',
    },
    {
      name: 'Whitespace-only query treated as empty',
      description: 'GET /api/travelmanager/search?q=%20%20%20',
      expected: '{ trips: [], vendors: [], clients: [] } — q.trim() produces empty string.',
      codeRef: 'src/app/api/travelmanager/search/route.ts:10 — q?.trim()',
    },
  ];

  manualTests.forEach((test, i) => {
    console.log(`  ${i + 1}. ${test.name}`);
    console.log(`     ${test.description}`);
    console.log(`     Expected: ${test.expected}`);
    if (test.codeRef) console.log(`     Code: ${test.codeRef}`);
    console.log();
  });
}

// ─── Run ───

async function main() {
  console.log(`\nSearch Tests — Travel Manager`);
  console.log(`Target: ${BASE_URL}`);

  console.log('\n--- Automated Tests ---');

  await testSearchRequiresAuth();
  await testSpecialCharacterQueries();
  await testSearchMethodRestrictions();

  documentManualTests();

  console.log('--- Summary ---');
  console.log(`  Automated: ${passed} passed, ${failed} failed out of ${passed + failed}`);
  console.log(`  Documented: 13 manual test cases (require auth to automate)\n`);

  if (failed > 0) {
    console.log('RESULT: SOME TESTS FAILED\n');
    process.exit(1);
  } else {
    console.log('RESULT: ALL AUTOMATED TESTS PASSED\n');
  }
}

main().catch((err) => {
  console.error('Test runner error:', err);
  process.exit(1);
});
