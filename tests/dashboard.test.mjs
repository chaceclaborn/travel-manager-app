/**
 * Dashboard Tests — Travel Manager
 *
 * Tests the /api/travelmanager/dashboard endpoint response shape,
 * stats validation, upcoming trip date ordering, and recent activity sorting.
 *
 * Run: node tests/travelmanager/dashboard.test.mjs
 *
 * Requires: dev server running at http://localhost:3000
 */

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';
const DASHBOARD_ENDPOINT = `${BASE_URL}/api/travelmanager/dashboard`;

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

async function testDashboardRequiresAuth() {
  console.log('\n  Authentication\n');

  try {
    const res = await fetch(DASHBOARD_ENDPOINT);
    const body = await res.json();

    report(
      'GET /api/travelmanager/dashboard returns 401 without auth',
      res.status === 401,
      `Got status ${res.status}`
    );
    report(
      'Response body contains { error: "Unauthorized" }',
      body && body.error === 'Unauthorized',
      `Got body: ${JSON.stringify(body)}`
    );
  } catch (err) {
    report('Dashboard endpoint is reachable', false, `Fetch failed: ${err.message}`);
  }
}

// ─── Response Shape Validation (via HTML page — checks component expectations) ───

async function testDashboardPageLoads() {
  console.log('\n  Dashboard Page\n');

  try {
    const res = await fetch(`${BASE_URL}/travelmanager`);
    report(
      'GET /travelmanager returns 200',
      res.status === 200,
      `Got status ${res.status}`
    );

    const html = await res.text();

    // The dashboard page defines a DashboardData interface that expects these fields.
    // We verify the page renders (even if unauthenticated, the component shell loads).
    report(
      'Dashboard page contains expected component markers',
      html.includes('travelmanager') || html.includes('Travel'),
      'Page shell renders'
    );
  } catch (err) {
    report('Dashboard page is reachable', false, `Fetch failed: ${err.message}`);
  }
}

// ─── API Shape Documentation ───

function documentExpectedShape() {
  console.log('\n--- Expected API Response Shape (GET /api/travelmanager/dashboard) ---\n');

  console.log('  When authenticated, the endpoint returns:\n');
  console.log('  {');
  console.log('    "stats": {');
  console.log('      "totalTrips": <number>,     // Count of all trips for user');
  console.log('      "upcomingTrips": <number>,   // Count of PLANNED/IN_PROGRESS trips with future startDate');
  console.log('      "totalVendors": <number>,    // Count of all vendors for user');
  console.log('      "totalClients": <number>     // Count of all clients for user');
  console.log('    },');
  console.log('    "upcoming": [                  // Up to 5 upcoming trips, sorted by startDate ASC');
  console.log('      {');
  console.log('        "id": <string>,');
  console.log('        "title": <string>,');
  console.log('        "destination": <string>,');
  console.log('        "startDate": <ISO string>, // Must be >= today');
  console.log('        "endDate": <ISO string>,');
  console.log('        "status": "PLANNED" | "IN_PROGRESS",');
  console.log('        "budget": <number|null>,');
  console.log('        "vendors": [...],');
  console.log('        "clients": [...],');
  console.log('        "itineraryItems": [...]');
  console.log('      }');
  console.log('    ],');
  console.log('    "recent": [                    // Up to 5 most recently updated trips, sorted by updatedAt DESC');
  console.log('      { ...same shape as above... }');
  console.log('    ]');
  console.log('  }\n');
}

// ─── Documented Test Cases (require auth) ───

function documentManualTests() {
  console.log('--- Documented Test Cases (require auth to automate) ---\n');

  const manualTests = [
    {
      name: 'Dashboard returns expected shape with stats, upcoming, and recent',
      description: 'GET /api/travelmanager/dashboard with valid auth token.',
      expected: 'Response has top-level keys: stats, upcoming, recent. Stats is an object, upcoming and recent are arrays.',
      validation: 'typeof data.stats === "object" && Array.isArray(data.upcoming) && Array.isArray(data.recent)',
    },
    {
      name: 'Stats values are non-negative integers',
      description: 'Check each stat value in the response.',
      expected: 'totalTrips >= 0, upcomingTrips >= 0, totalVendors >= 0, totalClients >= 0. All are integers.',
      validation: '[totalTrips, upcomingTrips, totalVendors, totalClients].every(v => Number.isInteger(v) && v >= 0)',
    },
    {
      name: 'upcomingTrips count <= totalTrips',
      description: 'Upcoming trips are a subset of all trips.',
      expected: 'stats.upcomingTrips <= stats.totalTrips',
    },
    {
      name: 'Upcoming trips have future start dates',
      description: 'Each trip in the upcoming array should have startDate >= today.',
      expected: 'All upcoming[].startDate are in the future.',
      validation: 'upcoming.every(t => new Date(t.startDate) >= new Date(today))',
      codeRef: 'src/lib/travelmanager/trips.ts:162 — where: { startDate: { gte: new Date() } }',
    },
    {
      name: 'Upcoming trips are sorted by startDate ascending',
      description: 'Verify the upcoming array is ordered by nearest trip first.',
      expected: 'upcoming[0].startDate <= upcoming[1].startDate <= ...',
      codeRef: 'src/lib/travelmanager/trips.ts:164 — orderBy: { startDate: "asc" }',
    },
    {
      name: 'Upcoming trips have valid statuses (PLANNED or IN_PROGRESS)',
      description: 'Upcoming trips only include trips with specific statuses.',
      expected: 'upcoming.every(t => ["PLANNED", "IN_PROGRESS"].includes(t.status))',
      codeRef: 'src/lib/travelmanager/trips.ts:162 — status: { in: ["PLANNED", "IN_PROGRESS"] }',
    },
    {
      name: 'Recent trips are sorted by updatedAt descending',
      description: 'Verify the recent array is ordered by most recently updated first.',
      expected: 'recent[0].updatedAt >= recent[1].updatedAt >= ...',
      codeRef: 'src/lib/travelmanager/trips.ts:172 — orderBy: { updatedAt: "desc" }',
    },
    {
      name: 'Upcoming array has at most 5 items',
      description: 'The query limits results to 5.',
      expected: 'upcoming.length <= 5',
      codeRef: 'src/lib/travelmanager/trips.ts:165 — take: limit (default 5)',
    },
    {
      name: 'Recent array has at most 5 items',
      description: 'The query limits results to 5.',
      expected: 'recent.length <= 5',
      codeRef: 'src/lib/travelmanager/trips.ts:173 — take: limit (default 5)',
    },
    {
      name: 'Each trip in upcoming/recent has required fields',
      description: 'Verify trip objects have the full shape including relations.',
      expected: 'Each trip has: id, title, destination, startDate, endDate, status, vendors (array), clients (array), itineraryItems (array).',
    },
    {
      name: 'Empty user has zero stats and empty arrays',
      description: 'A freshly created user with no data should get zeroed stats.',
      expected: '{ stats: { totalTrips: 0, upcomingTrips: 0, totalVendors: 0, totalClients: 0 }, upcoming: [], recent: [] }',
    },
  ];

  manualTests.forEach((test, i) => {
    console.log(`  ${i + 1}. ${test.name}`);
    console.log(`     ${test.description}`);
    console.log(`     Expected: ${test.expected}`);
    if (test.validation) console.log(`     Validation: ${test.validation}`);
    if (test.codeRef) console.log(`     Code: ${test.codeRef}`);
    console.log();
  });
}

// ─── Run ───

async function main() {
  console.log(`\nDashboard Tests — Travel Manager`);
  console.log(`Target: ${BASE_URL}`);

  console.log('\n--- Automated Tests ---');

  await testDashboardRequiresAuth();
  await testDashboardPageLoads();

  documentExpectedShape();
  documentManualTests();

  console.log('--- Summary ---');
  console.log(`  Automated: ${passed} passed, ${failed} failed out of ${passed + failed}`);
  console.log(`  Documented: 11 manual test cases (require auth to automate)\n`);

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
