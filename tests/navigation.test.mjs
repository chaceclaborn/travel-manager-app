/**
 * Navigation Tests — Travel Manager
 *
 * Tests page reachability, sidebar links, breadcrumbs, creation form links,
 * stats card hrefs, and calendar day links.
 *
 * Run: node tests/travelmanager/navigation.test.mjs
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

function assertContains(html, text, testName) {
  const found = html.includes(text);
  report(testName, found, found ? undefined : `"${text}" not found in page`);
  return found;
}

// ─── Sidebar Navigation Links ───

async function testSidebarLinks() {
  console.log('\n  Sidebar Navigation Links\n');

  const sidebarRoutes = [
    { path: '/travelmanager', label: 'Dashboard', marker: 'Dashboard' },
    { path: '/travelmanager/trips', label: 'Trips', marker: 'Trips' },
    { path: '/travelmanager/vendors', label: 'Vendors', marker: 'Vendors' },
    { path: '/travelmanager/clients', label: 'Clients', marker: 'Clients' },
    { path: '/travelmanager/settings', label: 'Settings', marker: 'Settings' },
  ];

  for (const route of sidebarRoutes) {
    try {
      const res = await fetch(`${BASE_URL}${route.path}`);
      report(
        `Sidebar: ${route.label} (${route.path}) returns 200`,
        res.status === 200,
        `Got ${res.status}`
      );
    } catch (err) {
      report(`Sidebar: ${route.label} (${route.path}) is reachable`, false, `Fetch failed: ${err.message}`);
    }
  }
}

// ─── "New" Creation Form Pages ───

async function testCreationFormLinks() {
  console.log('\n  "New" Creation Form Pages\n');

  const newPages = [
    { path: '/travelmanager/trips/new', label: 'New Trip', marker: 'New Trip' },
    { path: '/travelmanager/vendors/new', label: 'New Vendor', marker: 'New Vendor' },
    { path: '/travelmanager/clients/new', label: 'New Client', marker: 'New Client' },
  ];

  for (const page of newPages) {
    try {
      const res = await fetch(`${BASE_URL}${page.path}`);
      report(
        `${page.label} page (${page.path}) returns 200`,
        res.status === 200,
        `Got ${res.status}`
      );

      const html = await res.text();
      assertContains(html, page.marker, `${page.label} page contains "${page.marker}" heading`);
    } catch (err) {
      report(`${page.label} page is reachable`, false, `Fetch failed: ${err.message}`);
    }
  }
}

// ─── Breadcrumb Links in "New" Pages ───

async function testBreadcrumbLinks() {
  console.log('\n  Breadcrumbs on Creation Pages\n');

  const breadcrumbTests = [
    {
      path: '/travelmanager/trips/new',
      label: 'New Trip',
      expectedBreadcrumbs: [
        { text: 'Dashboard', href: '/travelmanager' },
        { text: 'Trips', href: '/travelmanager/trips' },
      ],
    },
    {
      path: '/travelmanager/vendors/new',
      label: 'New Vendor',
      expectedBreadcrumbs: [
        { text: 'Dashboard', href: '/travelmanager' },
        { text: 'Vendors', href: '/travelmanager/vendors' },
      ],
    },
    {
      path: '/travelmanager/clients/new',
      label: 'New Client',
      expectedBreadcrumbs: [
        { text: 'Dashboard', href: '/travelmanager' },
        { text: 'Clients', href: '/travelmanager/clients' },
      ],
    },
  ];

  for (const test of breadcrumbTests) {
    try {
      const res = await fetch(`${BASE_URL}${test.path}`);
      const html = await res.text();

      for (const crumb of test.expectedBreadcrumbs) {
        // Breadcrumb links are rendered as <a href="...">Text</a> inside the TMBreadcrumb nav
        const hrefPattern = `href="${crumb.href}"`;
        const found = html.includes(hrefPattern) || html.includes(`href=\\"${crumb.href}\\"`);
        report(
          `${test.label} breadcrumb: "${crumb.text}" links to ${crumb.href}`,
          found,
          found ? undefined : `href="${crumb.href}" not found in HTML`
        );
      }
    } catch (err) {
      report(`${test.label} breadcrumbs`, false, `Fetch failed: ${err.message}`);
    }
  }
}

// ─── Dashboard Contains Navigation Links ───

async function testDashboardNavigationLinks() {
  console.log('\n  Dashboard Navigation Links (HTML contains hrefs)\n');

  try {
    const res = await fetch(`${BASE_URL}/travelmanager`);
    const html = await res.text();

    // Stats card hrefs (these are rendered in the HTML regardless of auth state because
    // TMStatsCard is a client component that always renders the Link wrapper)
    const statsLinks = [
      { href: '/travelmanager/trips', label: 'Total Trips stats card' },
      { href: '/travelmanager/trips?status=UPCOMING', label: 'Upcoming stats card' },
      { href: '/travelmanager/vendors', label: 'Vendors stats card' },
      { href: '/travelmanager/clients', label: 'Clients stats card' },
    ];

    for (const link of statsLinks) {
      // Client-rendered components may or may not have the href in the SSR HTML.
      // Check if the link reference exists in the page source.
      const found = html.includes(link.href);
      report(
        `Dashboard HTML contains "${link.label}" href (${link.href})`,
        found,
        found ? undefined : `href not found — may be client-rendered only`
      );
    }

    // Quick Action buttons
    const quickActions = [
      { href: '/travelmanager/trips/new', label: 'New Trip button' },
      { href: '/travelmanager/vendors/new', label: 'New Vendor button' },
      { href: '/travelmanager/clients/new', label: 'New Client button' },
    ];

    for (const action of quickActions) {
      const found = html.includes(action.href);
      report(
        `Dashboard HTML contains "${action.label}" href (${action.href})`,
        found,
        found ? undefined : `href not found — may be client-rendered only`
      );
    }
  } catch (err) {
    report('Dashboard page is reachable', false, `Fetch failed: ${err.message}`);
  }
}

// ─── List Pages Contain "New" Button Links ───

async function testListPageNewButtons() {
  console.log('\n  List Pages Contain "New" Button Links\n');

  const listPages = [
    { path: '/travelmanager/trips', newHref: '/travelmanager/trips/new', label: 'Trips list -> New Trip' },
    { path: '/travelmanager/vendors', newHref: '/travelmanager/vendors/new', label: 'Vendors list -> New Vendor' },
    { path: '/travelmanager/clients', newHref: '/travelmanager/clients/new', label: 'Clients list -> New Client' },
  ];

  for (const page of listPages) {
    try {
      const res = await fetch(`${BASE_URL}${page.path}`);
      const html = await res.text();
      const found = html.includes(page.newHref);
      report(
        `${page.label}: page contains href to ${page.newHref}`,
        found,
        found ? undefined : `href not found in page HTML`
      );
    } catch (err) {
      report(`${page.label}`, false, `Fetch failed: ${err.message}`);
    }
  }
}

// ─── Detail Pages Return 200 (with fake IDs, content depends on auth) ───

async function testDetailPageRoutes() {
  console.log('\n  Detail Page Routes Exist\n');

  const detailPages = [
    { path: '/travelmanager/trips/some-fake-id', label: 'Trip detail route' },
    { path: '/travelmanager/vendors/some-fake-id', label: 'Vendor detail route' },
    { path: '/travelmanager/clients/some-fake-id', label: 'Client detail route' },
  ];

  for (const page of detailPages) {
    try {
      const res = await fetch(`${BASE_URL}${page.path}`);
      // These pages should return 200 (the shell renders, data loading happens client-side)
      report(
        `${page.label} (${page.path}) returns 200`,
        res.status === 200,
        `Got ${res.status}`
      );
    } catch (err) {
      report(`${page.label} is reachable`, false, `Fetch failed: ${err.message}`);
    }
  }
}

// ─── Documented Manual Tests ───

function documentManualTests() {
  console.log('\n--- Documented Test Cases (require auth + data to verify) ---\n');

  const manualTests = [
    {
      name: 'Sidebar active state highlights current page',
      description: 'Navigate to /travelmanager/trips. The "Trips" sidebar link should have the active style (amber border, amber background).',
      expected: 'The TMSidebar component sets aria-current="page" and applies amber active styles when pathname starts with href.',
      codeRef: 'src/components/travelmanager/TMSidebar.tsx:24-28',
    },
    {
      name: 'Stats card "Total Trips" navigates to /travelmanager/trips',
      description: 'Click the "Total Trips" stats card on the dashboard.',
      expected: 'Navigates to /travelmanager/trips showing all trips.',
      codeRef: 'src/app/travelmanager/page.tsx:114 — href="/travelmanager/trips"',
    },
    {
      name: 'Stats card "Upcoming" navigates to /travelmanager/trips?status=UPCOMING',
      description: 'Click the "Upcoming" stats card on the dashboard.',
      expected: 'Navigates to /travelmanager/trips?status=UPCOMING. The status filter pre-selects "Upcoming".',
      codeRef: 'src/app/travelmanager/page.tsx:115 — href="/travelmanager/trips?status=UPCOMING"',
    },
    {
      name: 'Stats card "Days to Next Trip" navigates to the nearest trip detail',
      description: 'Click the "Days to Next Trip" stats card (only visible when upcoming trips exist).',
      expected: 'Navigates to /travelmanager/trips/{id} for the soonest upcoming trip.',
      codeRef: 'src/app/travelmanager/page.tsx:119 — href links to upcoming[0].id',
    },
    {
      name: 'Calendar day with trip navigates to trip detail',
      description: 'Click a calendar day that has trip dots (colored indicators).',
      expected: 'Navigates to /travelmanager/trips/{firstTrip.id} for the first trip on that day.',
      codeRef: 'src/components/travelmanager/TMCalendarPreview.tsx:137 — Link to first trip',
    },
    {
      name: 'Calendar day without trip is not clickable',
      description: 'Verify that calendar days with no trips are plain divs, not links.',
      expected: 'Days without trips render as <div> instead of <Link>.',
      codeRef: 'src/components/travelmanager/TMCalendarPreview.tsx:143',
    },
    {
      name: 'Trip detail breadcrumb: "Trips" links back to trip list',
      description: 'Open a trip detail page. Click "Trips" in the breadcrumb.',
      expected: 'Navigates back to /travelmanager/trips.',
      codeRef: 'src/app/travelmanager/trips/[id]/page.tsx:244',
    },
    {
      name: 'Trip detail breadcrumb: "Dashboard" links back to dashboard',
      description: 'Open a trip detail page. Click "Dashboard" in the breadcrumb.',
      expected: 'Navigates back to /travelmanager.',
      codeRef: 'src/app/travelmanager/trips/[id]/page.tsx:244',
    },
    {
      name: 'Vendor detail breadcrumb links back correctly',
      description: 'Open a vendor detail page. Click "Vendors" then "Dashboard" in the breadcrumb.',
      expected: '"Vendors" goes to /travelmanager/vendors, "Dashboard" goes to /travelmanager.',
      codeRef: 'src/app/travelmanager/vendors/[id]/page.tsx:123',
    },
    {
      name: 'Client detail breadcrumb links back correctly',
      description: 'Open a client detail page. Click "Clients" then "Dashboard" in the breadcrumb.',
      expected: '"Clients" goes to /travelmanager/clients, "Dashboard" goes to /travelmanager.',
      codeRef: 'src/app/travelmanager/clients/[id]/page.tsx:125',
    },
    {
      name: '"View all" link on upcoming trips section',
      description: 'On the dashboard, click "View all" next to "Upcoming Trips".',
      expected: 'Navigates to /travelmanager/trips.',
      codeRef: 'src/app/travelmanager/page.tsx:169',
    },
    {
      name: 'Clicking an upcoming trip card navigates to trip detail',
      description: 'Click any trip in the "Upcoming Trips" section of the dashboard.',
      expected: 'Navigates to /travelmanager/trips/{trip.id}.',
      codeRef: 'src/app/travelmanager/page.tsx:186-188',
    },
    {
      name: 'Clicking a recent activity trip navigates to trip detail',
      description: 'Click any trip in the "Recent Activity" section of the dashboard.',
      expected: 'Navigates to /travelmanager/trips/{trip.id}.',
      codeRef: 'src/app/travelmanager/page.tsx:237-239',
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
  console.log(`\nNavigation Tests — Travel Manager`);
  console.log(`Target: ${BASE_URL}`);

  console.log('\n--- Automated Tests ---');

  await testSidebarLinks();
  await testCreationFormLinks();
  await testBreadcrumbLinks();
  await testDashboardNavigationLinks();
  await testListPageNewButtons();
  await testDetailPageRoutes();

  documentManualTests();

  console.log('--- Summary ---');
  console.log(`  Automated: ${passed} passed, ${failed} failed out of ${passed + failed}`);
  console.log(`  Documented: 13 manual test cases (require auth + data to verify)\n`);

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
