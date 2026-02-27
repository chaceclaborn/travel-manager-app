const BASE_URL = 'http://localhost:3000';

const tests = [
  // Protected pages: unauthenticated — should not expose protected content.
  // Next.js App Router handles middleware redirects internally (200 + client-side redirect),
  // so we verify no sensitive data leaks rather than checking for HTTP 302.
  {
    label: 'GET /travelmanager -> no protected content exposed',
    path: '/travelmanager',
    expect: 'no_protected_content',
    forbiddenMarkers: ['My Trips', 'Dashboard Stats', 'Welcome back'],
  },
  {
    label: 'GET /travelmanager/trips -> no trip data exposed',
    path: '/travelmanager/trips',
    expect: 'no_protected_content',
    forbiddenMarkers: ['My Trips', 'trip-card', 'Add Trip', 'No trips yet'],
  },
  {
    label: 'GET /travelmanager/vendors -> no vendor data exposed',
    path: '/travelmanager/vendors',
    expect: 'no_protected_content',
    forbiddenMarkers: ['My Vendors', 'vendor-card', 'Add Vendor'],
  },
  {
    label: 'GET /travelmanager/clients -> no client data exposed',
    path: '/travelmanager/clients',
    expect: 'no_protected_content',
    forbiddenMarkers: ['My Clients', 'client-card', 'Add Client'],
  },
  {
    label: 'GET /travelmanager/settings -> no settings data exposed',
    path: '/travelmanager/settings',
    expect: 'no_protected_content',
    forbiddenMarkers: ['Account Settings', 'Delete Account', 'Export Data'],
  },

  // Public pages: should return 200 with expected content
  {
    label: 'GET /travelmanager/tour -> 200 with tour content',
    path: '/travelmanager/tour',
    expect: 'ok',
    bodyContains: 'Travel Manager',
  },
  {
    label: 'GET /travelmanager/privacy -> 200 with privacy content',
    path: '/travelmanager/privacy',
    expect: 'ok',
    bodyContains: 'Privacy',
  },

  // Non-TM pages: not affected by middleware, should return 200
  {
    label: 'GET / -> 200 (homepage)',
    path: '/',
    expect: 'ok',
  },
  {
    label: 'GET /portfolio -> 200 (non-TM page)',
    path: '/portfolio',
    expect: 'ok',
  },
];

let passed = 0;
let failed = 0;

console.log('Travel Manager Middleware & Routing Tests');
console.log('=========================================');
console.log('Verifying page access control and public page accessibility\n');

for (const test of tests) {
  try {
    const res = await fetch(`${BASE_URL}${test.path}`);
    const status = res.status;

    if (test.expect === 'no_protected_content') {
      // Page returns 200 (shell renders), but no sensitive content should leak
      const body = await res.text();
      const leakedMarkers = test.forbiddenMarkers.filter((m) => body.includes(m));

      if (status === 200 && leakedMarkers.length === 0) {
        console.log(`  PASS  ${test.label}`);
        passed++;
      } else if (status !== 200) {
        console.log(`  FAIL  ${test.label} -- unexpected status=${status}`);
        failed++;
      } else {
        console.log(`  FAIL  ${test.label} -- protected content leaked: ${leakedMarkers.join(', ')}`);
        failed++;
      }
    } else if (test.expect === 'ok') {
      if (status === 200) {
        if (test.bodyContains) {
          const body = await res.text();
          if (body.includes(test.bodyContains)) {
            console.log(`  PASS  ${test.label}`);
            passed++;
          } else {
            console.log(`  FAIL  ${test.label} -- body does not contain "${test.bodyContains}"`);
            failed++;
          }
        } else {
          console.log(`  PASS  ${test.label}`);
          passed++;
        }
      } else {
        console.log(`  FAIL  ${test.label} -- status=${status} (expected 200)`);
        failed++;
      }
    }
  } catch (err) {
    console.log(`  FAIL  ${test.label} -- ${err.message}`);
    failed++;
  }
}

console.log('\n=========================================');
console.log(`Results: ${passed} passed, ${failed} failed out of ${tests.length} tests`);

if (failed > 0) {
  process.exit(1);
}
