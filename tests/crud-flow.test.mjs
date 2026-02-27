/**
 * CRUD Flow Tests — Travel Manager
 *
 * Tests create/read/update/delete operations for trips, vendors, clients,
 * vendor/client linking, and itinerary items.
 *
 * All CRUD operations require authentication, so automated tests verify
 * that endpoints reject unauthenticated requests, and manual test cases
 * document the full authenticated flow.
 *
 * Run: node tests/travelmanager/crud-flow.test.mjs
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

// ─── Automated: CRUD Endpoints Require Auth ───

async function testCrudEndpointsRequireAuth() {
  console.log('\n  CRUD Endpoints Require Authentication\n');

  const endpoints = [
    // Trips CRUD
    { method: 'POST', path: '/api/travelmanager/trips', body: { title: 'Test', destination: 'Test', startDate: '2026-06-01', endDate: '2026-06-05' }, label: 'Create trip' },
    { method: 'GET', path: '/api/travelmanager/trips', label: 'List trips' },
    { method: 'GET', path: '/api/travelmanager/trips/fake-id', label: 'Get trip by ID' },
    { method: 'PUT', path: '/api/travelmanager/trips/fake-id', body: { title: 'Updated' }, label: 'Update trip' },
    { method: 'DELETE', path: '/api/travelmanager/trips/fake-id', label: 'Delete trip' },

    // Vendors CRUD
    { method: 'POST', path: '/api/travelmanager/vendors', body: { name: 'Test Vendor' }, label: 'Create vendor' },
    { method: 'GET', path: '/api/travelmanager/vendors', label: 'List vendors' },
    { method: 'GET', path: '/api/travelmanager/vendors/fake-id', label: 'Get vendor by ID' },
    { method: 'PUT', path: '/api/travelmanager/vendors/fake-id', body: { name: 'Updated' }, label: 'Update vendor' },
    { method: 'DELETE', path: '/api/travelmanager/vendors/fake-id', label: 'Delete vendor' },

    // Clients CRUD
    { method: 'POST', path: '/api/travelmanager/clients', body: { name: 'Test Client' }, label: 'Create client' },
    { method: 'GET', path: '/api/travelmanager/clients', label: 'List clients' },
    { method: 'GET', path: '/api/travelmanager/clients/fake-id', label: 'Get client by ID' },
    { method: 'PUT', path: '/api/travelmanager/clients/fake-id', body: { name: 'Updated' }, label: 'Update client' },
    { method: 'DELETE', path: '/api/travelmanager/clients/fake-id', label: 'Delete client' },

    // Linking
    { method: 'POST', path: '/api/travelmanager/trips/fake-id/vendors', body: { vendorId: 'fake-vendor' }, label: 'Link vendor to trip' },
    { method: 'POST', path: '/api/travelmanager/trips/fake-id/clients', body: { clientId: 'fake-client' }, label: 'Link client to trip' },

    // Itinerary
    { method: 'POST', path: '/api/travelmanager/trips/fake-id/itinerary', body: { title: 'Test Item', date: '2026-06-01' }, label: 'Create itinerary item' },
    { method: 'PUT', path: '/api/travelmanager/itinerary/fake-id', body: { title: 'Updated' }, label: 'Update itinerary item' },
    { method: 'DELETE', path: '/api/travelmanager/itinerary/fake-id', label: 'Delete itinerary item' },
  ];

  for (const ep of endpoints) {
    try {
      const opts = {
        method: ep.method,
        headers: { 'Content-Type': 'application/json' },
      };
      if (ep.body) opts.body = JSON.stringify(ep.body);

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

// ─── Automated: Validation Errors ───

async function testValidationErrors() {
  console.log('\n  Validation (endpoints reject invalid data even before auth)\n');

  // These should all return 401 since there's no auth, but we document what the
  // validation would return if auth was present.
  // The important thing is the endpoint exists and responds.

  const validationTests = [
    {
      label: 'POST /api/travelmanager/trips with empty body returns 401 (auth first)',
      method: 'POST',
      path: '/api/travelmanager/trips',
      body: {},
      expectedStatus: 401,
    },
    {
      label: 'POST /api/travelmanager/vendors with empty body returns 401 (auth first)',
      method: 'POST',
      path: '/api/travelmanager/vendors',
      body: {},
      expectedStatus: 401,
    },
    {
      label: 'POST /api/travelmanager/clients with empty body returns 401 (auth first)',
      method: 'POST',
      path: '/api/travelmanager/clients',
      body: {},
      expectedStatus: 401,
    },
  ];

  for (const test of validationTests) {
    try {
      const res = await fetch(`${BASE_URL}${test.path}`, {
        method: test.method,
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

// ─── Documented Manual Tests ───

function documentManualTests() {
  console.log('\n--- Documented CRUD Test Cases (require auth to automate) ---\n');

  const manualTests = [
    // Trip CRUD
    {
      name: 'Create a trip',
      steps: [
        'POST /api/travelmanager/trips with { title: "Test Trip", destination: "Paris", startDate: "2026-07-01", endDate: "2026-07-10", status: "PLANNED", budget: 5000 }',
        'Verify response status is 201',
        'Verify response body has id, title, destination, startDate, endDate, status, budget',
        'Save the returned trip.id for subsequent tests',
      ],
      expected: 'Trip is created with all provided fields. Status defaults to PLANNED if not given.',
      codeRef: 'src/app/api/travelmanager/trips/route.ts:18-36',
    },
    {
      name: 'Verify created trip appears in list',
      steps: [
        'GET /api/travelmanager/trips',
        'Verify the response array contains the trip with the saved id',
      ],
      expected: 'Array includes { id: savedId, title: "Test Trip", destination: "Paris", ... }',
    },
    {
      name: 'Update trip title',
      steps: [
        'PUT /api/travelmanager/trips/{id} with { title: "Updated Trip Title" }',
        'Verify response body has title: "Updated Trip Title"',
        'GET /api/travelmanager/trips/{id} and verify title persisted',
      ],
      expected: 'Title is updated. Other fields remain unchanged.',
      codeRef: 'src/app/api/travelmanager/trips/[id]/route.ts:20-33',
    },
    {
      name: 'Delete trip',
      steps: [
        'DELETE /api/travelmanager/trips/{id}',
        'Verify response { success: true }',
        'GET /api/travelmanager/trips/{id} returns 404',
        'GET /api/travelmanager/trips and verify trip is no longer in the list',
      ],
      expected: 'Trip is removed. Associated itinerary items and link records (TripVendor, TripClient) are cascade-deleted.',
      codeRef: 'src/app/api/travelmanager/trips/[id]/route.ts:35-47',
    },

    // Vendor CRUD
    {
      name: 'Create a vendor',
      steps: [
        'POST /api/travelmanager/vendors with { name: "Test Hotel", category: "HOTEL", email: "hotel@test.com", city: "Paris" }',
        'Verify response status is 201',
        'Verify response body has id, name, category, email, city',
      ],
      expected: 'Vendor created. Name is required; other fields are optional.',
      codeRef: 'src/app/api/travelmanager/vendors/route.ts:18-36',
    },
    {
      name: 'Verify created vendor appears in list',
      steps: [
        'GET /api/travelmanager/vendors',
        'Verify the response array contains the vendor with the saved id',
      ],
      expected: 'Array includes { id: savedId, name: "Test Hotel", category: "HOTEL", ... }',
    },
    {
      name: 'Update vendor name',
      steps: [
        'PUT /api/travelmanager/vendors/{id} with { name: "Updated Hotel Name" }',
        'Verify response body has name: "Updated Hotel Name"',
      ],
      expected: 'Name is updated. Other fields remain unchanged.',
    },
    {
      name: 'Delete vendor',
      steps: [
        'DELETE /api/travelmanager/vendors/{id}',
        'Verify response { success: true }',
        'GET /api/travelmanager/vendors/{id} returns 404',
      ],
      expected: 'Vendor is removed.',
    },

    // Client CRUD
    {
      name: 'Create a client',
      steps: [
        'POST /api/travelmanager/clients with { name: "John Doe", company: "ACME Corp", email: "john@acme.com" }',
        'Verify response status is 201',
        'Verify response body has id, name, company, email',
      ],
      expected: 'Client created. Name is required; company, email, phone, notes are optional.',
      codeRef: 'src/app/api/travelmanager/clients/route.ts:18-36',
    },
    {
      name: 'Verify created client appears in list',
      steps: [
        'GET /api/travelmanager/clients',
        'Verify the response array contains the client with the saved id',
      ],
      expected: 'Array includes { id: savedId, name: "John Doe", company: "ACME Corp", ... }',
    },
    {
      name: 'Update client name',
      steps: [
        'PUT /api/travelmanager/clients/{id} with { name: "Jane Doe" }',
        'Verify response body has name: "Jane Doe"',
      ],
      expected: 'Name is updated. Other fields remain unchanged.',
    },
    {
      name: 'Delete client',
      steps: [
        'DELETE /api/travelmanager/clients/{id}',
        'Verify response { success: true }',
        'GET /api/travelmanager/clients/{id} returns 404',
      ],
      expected: 'Client is removed.',
    },

    // Vendor linking
    {
      name: 'Link vendor to trip',
      steps: [
        'Create a trip and a vendor (if not already created)',
        'POST /api/travelmanager/trips/{tripId}/vendors with { vendorId: vendorId }',
        'Verify response status is 201',
        'GET /api/travelmanager/trips/{tripId}/vendors and verify vendor appears in list',
      ],
      expected: 'Vendor is linked to trip. GET returns array of TripVendor objects with nested vendor data.',
      codeRef: 'src/app/api/travelmanager/trips/[id]/vendors/route.ts:19-43',
    },
    {
      name: 'Unlink vendor from trip',
      steps: [
        'POST /api/travelmanager/trips/{tripId}/vendors with { vendorId: vendorId, action: "unlink" }',
        'Verify response { success: true }',
        'GET /api/travelmanager/trips/{tripId}/vendors and verify vendor is no longer in list',
      ],
      expected: 'Vendor is unlinked from trip. The vendor itself is NOT deleted.',
      codeRef: 'src/app/api/travelmanager/trips/[id]/vendors/route.ts:32-35',
    },

    // Client linking
    {
      name: 'Link client to trip',
      steps: [
        'Create a trip and a client (if not already created)',
        'POST /api/travelmanager/trips/{tripId}/clients with { clientId: clientId }',
        'Verify response status is 201',
        'GET /api/travelmanager/trips/{tripId}/clients and verify client appears in list',
      ],
      expected: 'Client is linked to trip.',
      codeRef: 'src/app/api/travelmanager/trips/[id]/clients/route.ts:19-43',
    },
    {
      name: 'Unlink client from trip',
      steps: [
        'POST /api/travelmanager/trips/{tripId}/clients with { clientId: clientId, action: "unlink" }',
        'Verify response { success: true }',
        'GET /api/travelmanager/trips/{tripId}/clients and verify client is no longer in list',
      ],
      expected: 'Client is unlinked from trip. The client itself is NOT deleted.',
      codeRef: 'src/app/api/travelmanager/trips/[id]/clients/route.ts:32-35',
    },

    // Itinerary items
    {
      name: 'Create itinerary item',
      steps: [
        'Create a trip (if not already created)',
        'POST /api/travelmanager/trips/{tripId}/itinerary with { title: "Visit Eiffel Tower", date: "2026-07-02", startTime: "10:00", endTime: "12:00", location: "Champ de Mars" }',
        'Verify response status is 201',
        'Verify response body has id, title, date, startTime, endTime, location',
        'GET /api/travelmanager/trips/{tripId}/itinerary and verify item appears',
      ],
      expected: 'Itinerary item created. Title and date are required; startTime, endTime, location, notes, sortOrder are optional.',
      codeRef: 'src/app/api/travelmanager/trips/[id]/itinerary/route.ts:19-47',
    },
    {
      name: 'Update itinerary item',
      steps: [
        'PUT /api/travelmanager/itinerary/{itemId} with { title: "Updated Activity" }',
        'Verify response body has title: "Updated Activity"',
      ],
      expected: 'Title is updated.',
      codeRef: 'src/app/api/travelmanager/itinerary/[id]/route.ts:5-18',
    },
    {
      name: 'Delete itinerary item',
      steps: [
        'DELETE /api/travelmanager/itinerary/{itemId}',
        'Verify response { success: true }',
        'GET /api/travelmanager/trips/{tripId}/itinerary and verify item is gone',
      ],
      expected: 'Itinerary item is deleted.',
      codeRef: 'src/app/api/travelmanager/itinerary/[id]/route.ts:20-32',
    },

    // Validation
    {
      name: 'Create trip without required fields returns 400',
      steps: [
        'POST /api/travelmanager/trips with { title: "No Dates" } (missing destination, startDate, endDate)',
      ],
      expected: 'Returns 400 with { error: "Title, destination, start date, and end date are required" }',
      codeRef: 'src/app/api/travelmanager/trips/route.ts:26-28',
    },
    {
      name: 'Create vendor without name returns 400',
      steps: [
        'POST /api/travelmanager/vendors with { category: "HOTEL" } (missing name)',
      ],
      expected: 'Returns 400 with { error: "Name is required" }',
      codeRef: 'src/app/api/travelmanager/vendors/route.ts:26-28',
    },
    {
      name: 'Create client without name returns 400',
      steps: [
        'POST /api/travelmanager/clients with { company: "ACME" } (missing name)',
      ],
      expected: 'Returns 400 with { error: "Name is required" }',
      codeRef: 'src/app/api/travelmanager/clients/route.ts:26-28',
    },
    {
      name: 'Create itinerary item without required fields returns 400',
      steps: [
        'POST /api/travelmanager/trips/{tripId}/itinerary with { location: "Paris" } (missing title and date)',
      ],
      expected: 'Returns 400 with { error: "Title and date are required" }',
      codeRef: 'src/app/api/travelmanager/trips/[id]/itinerary/route.ts:28-30',
    },
    {
      name: 'Link vendor without vendorId returns 400',
      steps: [
        'POST /api/travelmanager/trips/{tripId}/vendors with {} (missing vendorId)',
      ],
      expected: 'Returns 400 with { error: "Vendor ID is required" }',
      codeRef: 'src/app/api/travelmanager/trips/[id]/vendors/route.ts:28-30',
    },
    {
      name: 'Link client without clientId returns 400',
      steps: [
        'POST /api/travelmanager/trips/{tripId}/clients with {} (missing clientId)',
      ],
      expected: 'Returns 400 with { error: "Client ID is required" }',
      codeRef: 'src/app/api/travelmanager/trips/[id]/clients/route.ts:28-30',
    },
  ];

  manualTests.forEach((test, i) => {
    console.log(`  ${i + 1}. ${test.name}`);
    if (test.steps) {
      test.steps.forEach((step) => console.log(`     - ${step}`));
    }
    console.log(`     Expected: ${test.expected}`);
    if (test.codeRef) console.log(`     Code: ${test.codeRef}`);
    console.log();
  });
}

// ─── Run ───

async function main() {
  console.log(`\nCRUD Flow Tests — Travel Manager`);
  console.log(`Target: ${BASE_URL}`);

  console.log('\n--- Automated Tests ---');

  await testCrudEndpointsRequireAuth();
  await testValidationErrors();

  documentManualTests();

  console.log('--- Summary ---');
  console.log(`  Automated: ${passed} passed, ${failed} failed out of ${passed + failed}`);
  console.log(`  Documented: 25 manual test cases (require auth to automate)\n`);

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
