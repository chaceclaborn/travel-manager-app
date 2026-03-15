/**
 * Functional CRUD Tests — Travel Manager
 *
 * Comprehensive tests for all CRUD endpoints covering:
 * - Auth enforcement (401 without credentials)
 * - Validation (400 on bad input — blocked by auth first)
 * - Response structure verification
 * - Route availability (no 5xx crashes)
 * - Edge cases (invalid IDs, empty queries, boundary params)
 *
 * Run: node tests/functional-crud.test.mjs
 *
 * Requires: dev server running at http://localhost:3000
 */

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';
const FAKE_ID = 'nonexistent-id-00000';
const FAKE_UUID = '00000000-0000-0000-0000-000000000000';

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

async function safeFetch(url, opts = {}) {
  const res = await fetch(url, opts);
  const contentType = res.headers.get('content-type') || '';
  let body = null;
  if (contentType.includes('application/json')) {
    body = await res.json().catch(() => null);
  }
  return { res, body };
}

// ────────────────────────────────────────────────────────────
// 1. TRIPS API (17 tests)
// ────────────────────────────────────────────────────────────

async function testTripsApi() {
  console.log('\n  ── Trips API ──\n');

  // 1. GET /api/trips requires auth
  {
    const { res, body } = await safeFetch(`${BASE_URL}/api/trips`);
    report(
      'GET /api/trips requires auth (401)',
      res.status === 401 && body?.error === 'Unauthorized',
      `status=${res.status}`
    );
  }

  // 2. POST /api/trips requires auth
  {
    const { res, body } = await safeFetch(`${BASE_URL}/api/trips`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Test Trip' }),
    });
    report(
      'POST /api/trips requires auth (401)',
      res.status === 401 && body?.error === 'Unauthorized',
      `status=${res.status}`
    );
  }

  // 3. POST /api/trips with missing title (auth blocks first, so expect 401)
  {
    const { res } = await safeFetch(`${BASE_URL}/api/trips`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ destination: 'Paris' }),
    });
    report(
      'POST /api/trips with missing title returns 401 (auth first)',
      res.status === 401,
      `status=${res.status}`
    );
  }

  // 4. POST /api/trips with empty body returns 401
  {
    const { res } = await safeFetch(`${BASE_URL}/api/trips`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    report(
      'POST /api/trips with empty body returns 401 (auth first)',
      res.status === 401,
      `status=${res.status}`
    );
  }

  // 5. GET /api/trips/nonexistent returns 401 (auth blocks before 404)
  {
    const { res, body } = await safeFetch(`${BASE_URL}/api/trips/${FAKE_ID}`);
    report(
      'GET /api/trips/:id nonexistent returns 401',
      res.status === 401 && body?.error === 'Unauthorized',
      `status=${res.status}`
    );
  }

  // 6. GET /api/trips with UUID-format ID returns 401
  {
    const { res } = await safeFetch(`${BASE_URL}/api/trips/${FAKE_UUID}`);
    report(
      'GET /api/trips/:id with UUID-format ID returns 401',
      res.status === 401,
      `status=${res.status}`
    );
  }

  // 7. PUT /api/trips/nonexistent requires auth
  {
    const { res, body } = await safeFetch(`${BASE_URL}/api/trips/${FAKE_ID}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Updated' }),
    });
    report(
      'PUT /api/trips/:id requires auth (401)',
      res.status === 401 && body?.error === 'Unauthorized',
      `status=${res.status}`
    );
  }

  // 8. DELETE /api/trips/nonexistent requires auth
  {
    const { res, body } = await safeFetch(`${BASE_URL}/api/trips/${FAKE_ID}`, {
      method: 'DELETE',
    });
    report(
      'DELETE /api/trips/:id requires auth (401)',
      res.status === 401 && body?.error === 'Unauthorized',
      `status=${res.status}`
    );
  }

  // 9. GET /api/trips does not return 5xx
  {
    const { res } = await safeFetch(`${BASE_URL}/api/trips`);
    report(
      'GET /api/trips does not return 5xx',
      res.status < 500,
      `status=${res.status}`
    );
  }

  // 10-17. Trip sub-resources: itinerary, expenses, bookings, checklists, notes, attachments, vendors, clients
  const subResources = [
    { name: 'itinerary',   methods: ['GET', 'POST'] },
    { name: 'expenses',    methods: ['GET', 'POST'] },
    { name: 'bookings',    methods: ['GET', 'POST'] },
    { name: 'checklists',  methods: ['GET', 'POST'] },
    { name: 'notes',       methods: ['GET', 'POST'] },
    { name: 'attachments', methods: ['GET', 'POST'] },
    { name: 'vendors',     methods: ['GET', 'POST'] },
    { name: 'clients',     methods: ['GET', 'POST'] },
  ];

  for (const sub of subResources) {
    const { res, body } = await safeFetch(`${BASE_URL}/api/trips/${FAKE_ID}/${sub.name}`);
    report(
      `GET /api/trips/:id/${sub.name} requires auth (401)`,
      res.status === 401 && body?.error === 'Unauthorized',
      `status=${res.status}`
    );
  }

  // 18. POST to trip sub-resource (itinerary) requires auth
  {
    const { res } = await safeFetch(`${BASE_URL}/api/trips/${FAKE_ID}/itinerary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Visit Eiffel Tower', date: '2026-06-15' }),
    });
    report(
      'POST /api/trips/:id/itinerary requires auth (401)',
      res.status === 401,
      `status=${res.status}`
    );
  }

  // 19. POST trip duplicate requires auth
  {
    const { res } = await safeFetch(`${BASE_URL}/api/trips/${FAKE_ID}/duplicate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    report(
      'POST /api/trips/:id/duplicate requires auth (401)',
      res.status === 401,
      `status=${res.status}`
    );
  }
}

// ────────────────────────────────────────────────────────────
// 2. VENDORS API (12 tests)
// ────────────────────────────────────────────────────────────

async function testVendorsApi() {
  console.log('\n  ── Vendors API ──\n');

  // 1. GET /api/vendors requires auth
  {
    const { res, body } = await safeFetch(`${BASE_URL}/api/vendors`);
    report(
      'GET /api/vendors requires auth (401)',
      res.status === 401 && body?.error === 'Unauthorized',
      `status=${res.status}`
    );
  }

  // 2. POST /api/vendors requires auth
  {
    const { res, body } = await safeFetch(`${BASE_URL}/api/vendors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Hilton', category: 'HOTEL' }),
    });
    report(
      'POST /api/vendors requires auth (401)',
      res.status === 401 && body?.error === 'Unauthorized',
      `status=${res.status}`
    );
  }

  // 3. POST /api/vendors with missing name returns 401 (auth first)
  {
    const { res } = await safeFetch(`${BASE_URL}/api/vendors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: 'HOTEL' }),
    });
    report(
      'POST /api/vendors with missing name returns 401 (auth first)',
      res.status === 401,
      `status=${res.status}`
    );
  }

  // 4. POST /api/vendors with empty body returns 401
  {
    const { res } = await safeFetch(`${BASE_URL}/api/vendors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    report(
      'POST /api/vendors with empty body returns 401 (auth first)',
      res.status === 401,
      `status=${res.status}`
    );
  }

  // 5. GET /api/vendors/:id with invalid ID requires auth
  {
    const { res, body } = await safeFetch(`${BASE_URL}/api/vendors/${FAKE_ID}`);
    report(
      'GET /api/vendors/:id with invalid ID requires auth (401)',
      res.status === 401 && body?.error === 'Unauthorized',
      `status=${res.status}`
    );
  }

  // 6. GET /api/vendors/:id with UUID-format ID requires auth
  {
    const { res } = await safeFetch(`${BASE_URL}/api/vendors/${FAKE_UUID}`);
    report(
      'GET /api/vendors/:id with UUID returns 401',
      res.status === 401,
      `status=${res.status}`
    );
  }

  // 7. PUT /api/vendors/:id requires auth
  {
    const { res, body } = await safeFetch(`${BASE_URL}/api/vendors/${FAKE_ID}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated Vendor' }),
    });
    report(
      'PUT /api/vendors/:id requires auth (401)',
      res.status === 401 && body?.error === 'Unauthorized',
      `status=${res.status}`
    );
  }

  // 8. DELETE /api/vendors/:id requires auth
  {
    const { res, body } = await safeFetch(`${BASE_URL}/api/vendors/${FAKE_ID}`, {
      method: 'DELETE',
    });
    report(
      'DELETE /api/vendors/:id requires auth (401)',
      res.status === 401 && body?.error === 'Unauthorized',
      `status=${res.status}`
    );
  }

  // 9. GET /api/vendors does not return 5xx
  {
    const { res } = await safeFetch(`${BASE_URL}/api/vendors`);
    report(
      'GET /api/vendors does not return 5xx',
      res.status < 500,
      `status=${res.status}`
    );
  }

  // 10. 401 response body has correct structure
  {
    const { res, body } = await safeFetch(`${BASE_URL}/api/vendors`);
    report(
      'GET /api/vendors 401 body has { error: "Unauthorized" }',
      res.status === 401 && body?.error === 'Unauthorized' && typeof body.error === 'string',
      `body=${JSON.stringify(body)}`
    );
  }

  // 11. PUT /api/vendors/:id with empty body requires auth
  {
    const { res } = await safeFetch(`${BASE_URL}/api/vendors/${FAKE_ID}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    report(
      'PUT /api/vendors/:id with empty body returns 401',
      res.status === 401,
      `status=${res.status}`
    );
  }

  // 12. POST /api/vendors with extra unknown fields returns 401 (auth first)
  {
    const { res } = await safeFetch(`${BASE_URL}/api/vendors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test', unknownField: 'value', anotherBad: 123 }),
    });
    report(
      'POST /api/vendors with extra fields returns 401 (auth first)',
      res.status === 401,
      `status=${res.status}`
    );
  }
}

// ────────────────────────────────────────────────────────────
// 3. CLIENTS API (12 tests)
// ────────────────────────────────────────────────────────────

async function testClientsApi() {
  console.log('\n  ── Clients API ──\n');

  // 1. GET /api/clients requires auth
  {
    const { res, body } = await safeFetch(`${BASE_URL}/api/clients`);
    report(
      'GET /api/clients requires auth (401)',
      res.status === 401 && body?.error === 'Unauthorized',
      `status=${res.status}`
    );
  }

  // 2. POST /api/clients requires auth
  {
    const { res, body } = await safeFetch(`${BASE_URL}/api/clients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'John Doe', company: 'ACME' }),
    });
    report(
      'POST /api/clients requires auth (401)',
      res.status === 401 && body?.error === 'Unauthorized',
      `status=${res.status}`
    );
  }

  // 3. POST /api/clients with missing name returns 401 (auth first)
  {
    const { res } = await safeFetch(`${BASE_URL}/api/clients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company: 'ACME' }),
    });
    report(
      'POST /api/clients with missing name returns 401 (auth first)',
      res.status === 401,
      `status=${res.status}`
    );
  }

  // 4. POST /api/clients with empty body returns 401
  {
    const { res } = await safeFetch(`${BASE_URL}/api/clients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    report(
      'POST /api/clients with empty body returns 401 (auth first)',
      res.status === 401,
      `status=${res.status}`
    );
  }

  // 5. GET /api/clients/:id with invalid ID requires auth
  {
    const { res, body } = await safeFetch(`${BASE_URL}/api/clients/${FAKE_ID}`);
    report(
      'GET /api/clients/:id with invalid ID requires auth (401)',
      res.status === 401 && body?.error === 'Unauthorized',
      `status=${res.status}`
    );
  }

  // 6. GET /api/clients/:id with UUID-format ID requires auth
  {
    const { res } = await safeFetch(`${BASE_URL}/api/clients/${FAKE_UUID}`);
    report(
      'GET /api/clients/:id with UUID returns 401',
      res.status === 401,
      `status=${res.status}`
    );
  }

  // 7. PUT /api/clients/:id requires auth
  {
    const { res, body } = await safeFetch(`${BASE_URL}/api/clients/${FAKE_ID}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated Client' }),
    });
    report(
      'PUT /api/clients/:id requires auth (401)',
      res.status === 401 && body?.error === 'Unauthorized',
      `status=${res.status}`
    );
  }

  // 8. DELETE /api/clients/:id requires auth
  {
    const { res, body } = await safeFetch(`${BASE_URL}/api/clients/${FAKE_ID}`, {
      method: 'DELETE',
    });
    report(
      'DELETE /api/clients/:id requires auth (401)',
      res.status === 401 && body?.error === 'Unauthorized',
      `status=${res.status}`
    );
  }

  // 9. GET /api/clients does not return 5xx
  {
    const { res } = await safeFetch(`${BASE_URL}/api/clients`);
    report(
      'GET /api/clients does not return 5xx',
      res.status < 500,
      `status=${res.status}`
    );
  }

  // 10. 401 response body has correct structure
  {
    const { res, body } = await safeFetch(`${BASE_URL}/api/clients`);
    report(
      'GET /api/clients 401 body has { error: "Unauthorized" }',
      res.status === 401 && body?.error === 'Unauthorized',
      `body=${JSON.stringify(body)}`
    );
  }

  // 11. PUT /api/clients/:id with empty body requires auth
  {
    const { res } = await safeFetch(`${BASE_URL}/api/clients/${FAKE_ID}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    report(
      'PUT /api/clients/:id with empty body returns 401',
      res.status === 401,
      `status=${res.status}`
    );
  }

  // 12. POST /api/clients with extra unknown fields returns 401 (auth first)
  {
    const { res } = await safeFetch(`${BASE_URL}/api/clients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test', unknownField: 'value' }),
    });
    report(
      'POST /api/clients with extra fields returns 401 (auth first)',
      res.status === 401,
      `status=${res.status}`
    );
  }
}

// ────────────────────────────────────────────────────────────
// 4. BOOKINGS API (16 tests)
// ────────────────────────────────────────────────────────────

async function testBookingsApi() {
  console.log('\n  ── Bookings API ──\n');

  // Standalone bookings

  // 1. GET /api/bookings requires auth
  {
    const { res, body } = await safeFetch(`${BASE_URL}/api/bookings`);
    report(
      'GET /api/bookings (standalone list) requires auth (401)',
      res.status === 401 && body?.error === 'Unauthorized',
      `status=${res.status}`
    );
  }

  // 2. POST /api/bookings requires auth
  {
    const { res, body } = await safeFetch(`${BASE_URL}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'Delta', type: 'FLIGHT' }),
    });
    report(
      'POST /api/bookings (standalone create) requires auth (401)',
      res.status === 401 && body?.error === 'Unauthorized',
      `status=${res.status}`
    );
  }

  // 3. POST /api/bookings with missing provider returns 401 (auth first)
  {
    const { res } = await safeFetch(`${BASE_URL}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'FLIGHT' }),
    });
    report(
      'POST /api/bookings with missing provider returns 401 (auth first)',
      res.status === 401,
      `status=${res.status}`
    );
  }

  // 4. POST /api/bookings with missing type returns 401 (auth first)
  {
    const { res } = await safeFetch(`${BASE_URL}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'Delta' }),
    });
    report(
      'POST /api/bookings with missing type returns 401 (auth first)',
      res.status === 401,
      `status=${res.status}`
    );
  }

  // 5. POST /api/bookings with empty body returns 401
  {
    const { res } = await safeFetch(`${BASE_URL}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    report(
      'POST /api/bookings with empty body returns 401 (auth first)',
      res.status === 401,
      `status=${res.status}`
    );
  }

  // 6. GET /api/bookings/:id requires auth
  {
    const { res, body } = await safeFetch(`${BASE_URL}/api/bookings/${FAKE_ID}`);
    report(
      'GET /api/bookings/:id requires auth (401)',
      res.status === 401 && body?.error === 'Unauthorized',
      `status=${res.status}`
    );
  }

  // 7. GET /api/bookings/:id with UUID requires auth
  {
    const { res } = await safeFetch(`${BASE_URL}/api/bookings/${FAKE_UUID}`);
    report(
      'GET /api/bookings/:id with UUID returns 401',
      res.status === 401,
      `status=${res.status}`
    );
  }

  // 8. PUT /api/bookings/:id requires auth
  {
    const { res, body } = await safeFetch(`${BASE_URL}/api/bookings/${FAKE_ID}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'Updated' }),
    });
    report(
      'PUT /api/bookings/:id requires auth (401)',
      res.status === 401 && body?.error === 'Unauthorized',
      `status=${res.status}`
    );
  }

  // 9. DELETE /api/bookings/:id requires auth
  {
    const { res, body } = await safeFetch(`${BASE_URL}/api/bookings/${FAKE_ID}`, {
      method: 'DELETE',
    });
    report(
      'DELETE /api/bookings/:id requires auth (401)',
      res.status === 401 && body?.error === 'Unauthorized',
      `status=${res.status}`
    );
  }

  // 10. PATCH /api/bookings/:id (link to trip) requires auth
  {
    const { res, body } = await safeFetch(`${BASE_URL}/api/bookings/${FAKE_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tripId: FAKE_UUID }),
    });
    report(
      'PATCH /api/bookings/:id (link to trip) requires auth (401)',
      res.status === 401 && body?.error === 'Unauthorized',
      `status=${res.status}`
    );
  }

  // 11. PATCH /api/bookings/:id with empty body requires auth
  {
    const { res } = await safeFetch(`${BASE_URL}/api/bookings/${FAKE_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    report(
      'PATCH /api/bookings/:id with empty body returns 401',
      res.status === 401,
      `status=${res.status}`
    );
  }

  // Trip-scoped bookings

  // 12. GET /api/trips/:id/bookings requires auth
  {
    const { res, body } = await safeFetch(`${BASE_URL}/api/trips/${FAKE_ID}/bookings`);
    report(
      'GET /api/trips/:id/bookings requires auth (401)',
      res.status === 401 && body?.error === 'Unauthorized',
      `status=${res.status}`
    );
  }

  // 13. POST /api/trips/:id/bookings requires auth
  {
    const { res, body } = await safeFetch(`${BASE_URL}/api/trips/${FAKE_ID}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'Hilton', type: 'HOTEL' }),
    });
    report(
      'POST /api/trips/:id/bookings requires auth (401)',
      res.status === 401 && body?.error === 'Unauthorized',
      `status=${res.status}`
    );
  }

  // 14. GET /api/bookings does not return 5xx
  {
    const { res } = await safeFetch(`${BASE_URL}/api/bookings`);
    report(
      'GET /api/bookings does not return 5xx',
      res.status < 500,
      `status=${res.status}`
    );
  }

  // 15. 401 response body for bookings has correct structure
  {
    const { res, body } = await safeFetch(`${BASE_URL}/api/bookings`);
    report(
      'GET /api/bookings 401 body has { error: "Unauthorized" }',
      res.status === 401 && body?.error === 'Unauthorized',
      `body=${JSON.stringify(body)}`
    );
  }

  // 16. PUT /api/bookings/:id with empty body requires auth
  {
    const { res } = await safeFetch(`${BASE_URL}/api/bookings/${FAKE_ID}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    report(
      'PUT /api/bookings/:id with empty body returns 401',
      res.status === 401,
      `status=${res.status}`
    );
  }
}

// ────────────────────────────────────────────────────────────
// 5. DOCUMENTS API (10 tests)
// ────────────────────────────────────────────────────────────

async function testDocumentsApi() {
  console.log('\n  ── Documents API ──\n');

  // 1. GET /api/documents requires auth
  {
    const { res, body } = await safeFetch(`${BASE_URL}/api/documents`);
    report(
      'GET /api/documents requires auth (401)',
      res.status === 401 && body?.error === 'Unauthorized',
      `status=${res.status}`
    );
  }

  // 2. GET /api/documents?expiring=true requires auth
  {
    const { res, body } = await safeFetch(`${BASE_URL}/api/documents?expiring=true`);
    report(
      'GET /api/documents?expiring=true requires auth (401)',
      res.status === 401 && body?.error === 'Unauthorized',
      `status=${res.status}`
    );
  }

  // 3. GET /api/documents?expiring=false requires auth
  {
    const { res } = await safeFetch(`${BASE_URL}/api/documents?expiring=false`);
    report(
      'GET /api/documents?expiring=false requires auth (401)',
      res.status === 401,
      `status=${res.status}`
    );
  }

  // 4. POST /api/documents requires auth
  {
    const { res, body } = await safeFetch(`${BASE_URL}/api/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'PASSPORT', label: 'My Passport' }),
    });
    report(
      'POST /api/documents requires auth (401)',
      res.status === 401 && body?.error === 'Unauthorized',
      `status=${res.status}`
    );
  }

  // 5. POST /api/documents with missing type returns 401 (auth first)
  {
    const { res } = await safeFetch(`${BASE_URL}/api/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: 'My Passport' }),
    });
    report(
      'POST /api/documents with missing type returns 401 (auth first)',
      res.status === 401,
      `status=${res.status}`
    );
  }

  // 6. POST /api/documents with missing label returns 401 (auth first)
  {
    const { res } = await safeFetch(`${BASE_URL}/api/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'PASSPORT' }),
    });
    report(
      'POST /api/documents with missing label returns 401 (auth first)',
      res.status === 401,
      `status=${res.status}`
    );
  }

  // 7. GET /api/documents/:id requires auth
  {
    const { res, body } = await safeFetch(`${BASE_URL}/api/documents/${FAKE_ID}`);
    report(
      'GET /api/documents/:id requires auth (401)',
      res.status === 401 && body?.error === 'Unauthorized',
      `status=${res.status}`
    );
  }

  // 8. PUT /api/documents/:id requires auth
  {
    const { res, body } = await safeFetch(`${BASE_URL}/api/documents/${FAKE_ID}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: 'Updated Doc' }),
    });
    report(
      'PUT /api/documents/:id requires auth (401)',
      res.status === 401 && body?.error === 'Unauthorized',
      `status=${res.status}`
    );
  }

  // 9. DELETE /api/documents/:id requires auth
  {
    const { res, body } = await safeFetch(`${BASE_URL}/api/documents/${FAKE_ID}`, {
      method: 'DELETE',
    });
    report(
      'DELETE /api/documents/:id requires auth (401)',
      res.status === 401 && body?.error === 'Unauthorized',
      `status=${res.status}`
    );
  }

  // 10. GET /api/documents does not return 5xx
  {
    const { res } = await safeFetch(`${BASE_URL}/api/documents`);
    report(
      'GET /api/documents does not return 5xx',
      res.status < 500,
      `status=${res.status}`
    );
  }
}

// ────────────────────────────────────────────────────────────
// 6. DASHBOARD / ANALYTICS / SEARCH (14 tests)
// ────────────────────────────────────────────────────────────

async function testDashboardAnalyticsSearch() {
  console.log('\n  ── Dashboard / Analytics / Search ──\n');

  // Dashboard

  // 1. GET /api/dashboard requires auth
  {
    const { res, body } = await safeFetch(`${BASE_URL}/api/dashboard`);
    report(
      'GET /api/dashboard requires auth (401)',
      res.status === 401 && body?.error === 'Unauthorized',
      `status=${res.status}`
    );
  }

  // 2. GET /api/dashboard returns JSON content-type
  {
    const { res } = await safeFetch(`${BASE_URL}/api/dashboard`);
    const ct = res.headers.get('content-type') || '';
    report(
      'GET /api/dashboard returns JSON content-type',
      ct.includes('application/json'),
      `content-type=${ct}`
    );
  }

  // 3. GET /api/dashboard does not return 5xx
  {
    const { res } = await safeFetch(`${BASE_URL}/api/dashboard`);
    report(
      'GET /api/dashboard does not return 5xx',
      res.status < 500,
      `status=${res.status}`
    );
  }

  // Analytics

  // 4. GET /api/analytics requires auth
  {
    const { res, body } = await safeFetch(`${BASE_URL}/api/analytics`);
    report(
      'GET /api/analytics requires auth (401)',
      res.status === 401 && body?.error === 'Unauthorized',
      `status=${res.status}`
    );
  }

  // 5. GET /api/analytics?period=3months requires auth
  {
    const { res } = await safeFetch(`${BASE_URL}/api/analytics?period=3months`);
    report(
      'GET /api/analytics?period=3months requires auth (401)',
      res.status === 401,
      `status=${res.status}`
    );
  }

  // 6. GET /api/analytics?period=6months requires auth
  {
    const { res } = await safeFetch(`${BASE_URL}/api/analytics?period=6months`);
    report(
      'GET /api/analytics?period=6months requires auth (401)',
      res.status === 401,
      `status=${res.status}`
    );
  }

  // 7. GET /api/analytics?period=1year requires auth
  {
    const { res } = await safeFetch(`${BASE_URL}/api/analytics?period=1year`);
    report(
      'GET /api/analytics?period=1year requires auth (401)',
      res.status === 401,
      `status=${res.status}`
    );
  }

  // 8. GET /api/analytics?period=all requires auth
  {
    const { res } = await safeFetch(`${BASE_URL}/api/analytics?period=all`);
    report(
      'GET /api/analytics?period=all requires auth (401)',
      res.status === 401,
      `status=${res.status}`
    );
  }

  // 9. GET /api/analytics does not return 5xx
  {
    const { res } = await safeFetch(`${BASE_URL}/api/analytics`);
    report(
      'GET /api/analytics does not return 5xx',
      res.status < 500,
      `status=${res.status}`
    );
  }

  // Search

  // 10. GET /api/search?q=test requires auth
  {
    const { res, body } = await safeFetch(`${BASE_URL}/api/search?q=test`);
    report(
      'GET /api/search?q=test requires auth (401)',
      res.status === 401 && body?.error === 'Unauthorized',
      `status=${res.status}`
    );
  }

  // 11. GET /api/search with empty query requires auth
  {
    const { res } = await safeFetch(`${BASE_URL}/api/search?q=`);
    report(
      'GET /api/search?q= (empty) requires auth (401)',
      res.status === 401,
      `status=${res.status}`
    );
  }

  // 12. GET /api/search with single char (min-length) requires auth
  {
    const { res } = await safeFetch(`${BASE_URL}/api/search?q=a`);
    report(
      'GET /api/search?q=a (1 char, under min-length) requires auth (401)',
      res.status === 401,
      `status=${res.status}`
    );
  }

  // 13. GET /api/search without q param requires auth
  {
    const { res } = await safeFetch(`${BASE_URL}/api/search`);
    report(
      'GET /api/search (no q param) requires auth (401)',
      res.status === 401,
      `status=${res.status}`
    );
  }

  // 14. GET /api/search does not return 5xx
  {
    const { res } = await safeFetch(`${BASE_URL}/api/search?q=test`);
    report(
      'GET /api/search does not return 5xx',
      res.status < 500,
      `status=${res.status}`
    );
  }
}

// ────────────────────────────────────────────────────────────
// 7. USER ACCOUNT (10 tests)
// ────────────────────────────────────────────────────────────

async function testUserApi() {
  console.log('\n  ── User Account API ──\n');

  // 1. GET /api/user requires auth
  {
    const { res, body } = await safeFetch(`${BASE_URL}/api/user`);
    report(
      'GET /api/user requires auth (401)',
      res.status === 401 && body?.error === 'Unauthorized',
      `status=${res.status}`
    );
  }

  // 2. GET /api/user/export requires auth
  {
    const { res } = await safeFetch(`${BASE_URL}/api/user/export`);
    // Export may return JSON 401 or possibly another format, check status
    report(
      'GET /api/user/export requires auth (401)',
      res.status === 401,
      `status=${res.status}`
    );
  }

  // 3. GET /api/user/sessions requires auth
  {
    const { res, body } = await safeFetch(`${BASE_URL}/api/user/sessions`);
    report(
      'GET /api/user/sessions requires auth (401)',
      res.status === 401 && body?.error === 'Unauthorized',
      `status=${res.status}`
    );
  }

  // 4. GET /api/user/summary requires auth
  {
    const { res } = await safeFetch(`${BASE_URL}/api/user/summary?period=3months`);
    report(
      'GET /api/user/summary?period=3months requires auth (401)',
      res.status === 401,
      `status=${res.status}`
    );
  }

  // 5. GET /api/user/summary?period=6months requires auth
  {
    const { res } = await safeFetch(`${BASE_URL}/api/user/summary?period=6months`);
    report(
      'GET /api/user/summary?period=6months requires auth (401)',
      res.status === 401,
      `status=${res.status}`
    );
  }

  // 6. GET /api/user/summary?period=1year requires auth
  {
    const { res } = await safeFetch(`${BASE_URL}/api/user/summary?period=1year`);
    report(
      'GET /api/user/summary?period=1year requires auth (401)',
      res.status === 401,
      `status=${res.status}`
    );
  }

  // 7. DELETE /api/user/delete requires auth
  {
    const { res, body } = await safeFetch(`${BASE_URL}/api/user/delete`, {
      method: 'DELETE',
    });
    report(
      'DELETE /api/user/delete requires auth (401)',
      res.status === 401 && body?.error === 'Unauthorized',
      `status=${res.status}`
    );
  }

  // 8. GET /api/user does not return 5xx
  {
    const { res } = await safeFetch(`${BASE_URL}/api/user`);
    report(
      'GET /api/user does not return 5xx',
      res.status < 500,
      `status=${res.status}`
    );
  }

  // 9. GET /api/user/sessions does not return 5xx
  {
    const { res } = await safeFetch(`${BASE_URL}/api/user/sessions`);
    report(
      'GET /api/user/sessions does not return 5xx',
      res.status < 500,
      `status=${res.status}`
    );
  }

  // 10. GET /api/user/summary with invalid period requires auth
  {
    const { res } = await safeFetch(`${BASE_URL}/api/user/summary?period=invalid`);
    report(
      'GET /api/user/summary?period=invalid requires auth (401)',
      res.status === 401,
      `status=${res.status}`
    );
  }
}

// ────────────────────────────────────────────────────────────
// 8. STANDALONE SUB-RESOURCE ROUTES (12 tests)
// ────────────────────────────────────────────────────────────

async function testStandaloneSubResources() {
  console.log('\n  ── Standalone Sub-Resource Routes ──\n');

  // Itinerary items
  // 1. PUT /api/itinerary/:id requires auth
  {
    const { res, body } = await safeFetch(`${BASE_URL}/api/itinerary/${FAKE_ID}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Updated Item' }),
    });
    report(
      'PUT /api/itinerary/:id requires auth (401)',
      res.status === 401 && body?.error === 'Unauthorized',
      `status=${res.status}`
    );
  }

  // 2. DELETE /api/itinerary/:id requires auth
  {
    const { res, body } = await safeFetch(`${BASE_URL}/api/itinerary/${FAKE_ID}`, {
      method: 'DELETE',
    });
    report(
      'DELETE /api/itinerary/:id requires auth (401)',
      res.status === 401 && body?.error === 'Unauthorized',
      `status=${res.status}`
    );
  }

  // Attachments
  // 3. GET /api/attachments/:id requires auth
  {
    const { res, body } = await safeFetch(`${BASE_URL}/api/attachments/${FAKE_ID}`);
    report(
      'GET /api/attachments/:id requires auth (401)',
      res.status === 401 && body?.error === 'Unauthorized',
      `status=${res.status}`
    );
  }

  // 4. DELETE /api/attachments/:id requires auth
  {
    const { res, body } = await safeFetch(`${BASE_URL}/api/attachments/${FAKE_ID}`, {
      method: 'DELETE',
    });
    report(
      'DELETE /api/attachments/:id requires auth (401)',
      res.status === 401 && body?.error === 'Unauthorized',
      `status=${res.status}`
    );
  }

  // Expenses
  // 5. GET /api/expenses/:id requires auth
  {
    const { res, body } = await safeFetch(`${BASE_URL}/api/expenses/${FAKE_ID}`);
    report(
      'GET /api/expenses/:id requires auth (401)',
      res.status === 401 && body?.error === 'Unauthorized',
      `status=${res.status}`
    );
  }

  // 6. PUT /api/expenses/:id requires auth
  {
    const { res, body } = await safeFetch(`${BASE_URL}/api/expenses/${FAKE_ID}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 100 }),
    });
    report(
      'PUT /api/expenses/:id requires auth (401)',
      res.status === 401 && body?.error === 'Unauthorized',
      `status=${res.status}`
    );
  }

  // 7. DELETE /api/expenses/:id requires auth
  {
    const { res, body } = await safeFetch(`${BASE_URL}/api/expenses/${FAKE_ID}`, {
      method: 'DELETE',
    });
    report(
      'DELETE /api/expenses/:id requires auth (401)',
      res.status === 401 && body?.error === 'Unauthorized',
      `status=${res.status}`
    );
  }

  // 8. POST /api/expenses/:id/receipt requires auth
  {
    const { res, body } = await safeFetch(`${BASE_URL}/api/expenses/${FAKE_ID}/receipt`, {
      method: 'POST',
    });
    report(
      'POST /api/expenses/:id/receipt requires auth (401)',
      res.status === 401 && body?.error === 'Unauthorized',
      `status=${res.status}`
    );
  }

  // Notes
  // 9. PUT /api/notes/:id requires auth
  {
    const { res, body } = await safeFetch(`${BASE_URL}/api/notes/${FAKE_ID}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Updated note' }),
    });
    report(
      'PUT /api/notes/:id requires auth (401)',
      res.status === 401 && body?.error === 'Unauthorized',
      `status=${res.status}`
    );
  }

  // 10. DELETE /api/notes/:id requires auth
  {
    const { res, body } = await safeFetch(`${BASE_URL}/api/notes/${FAKE_ID}`, {
      method: 'DELETE',
    });
    report(
      'DELETE /api/notes/:id requires auth (401)',
      res.status === 401 && body?.error === 'Unauthorized',
      `status=${res.status}`
    );
  }

  // Checklists
  // 11. PUT /api/checklists/:id requires auth
  {
    const { res, body } = await safeFetch(`${BASE_URL}/api/checklists/${FAKE_ID}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: 'Updated item', checked: true }),
    });
    report(
      'PUT /api/checklists/:id requires auth (401)',
      res.status === 401 && body?.error === 'Unauthorized',
      `status=${res.status}`
    );
  }

  // 12. DELETE /api/checklists/:id requires auth
  {
    const { res, body } = await safeFetch(`${BASE_URL}/api/checklists/${FAKE_ID}`, {
      method: 'DELETE',
    });
    report(
      'DELETE /api/checklists/:id requires auth (401)',
      res.status === 401 && body?.error === 'Unauthorized',
      `status=${res.status}`
    );
  }
}

// ────────────────────────────────────────────────────────────
// 9. RESPONSE STRUCTURE & CONTENT-TYPE CHECKS (8 tests)
// ────────────────────────────────────────────────────────────

async function testResponseStructure() {
  console.log('\n  ── Response Structure & Content-Type ──\n');

  const jsonEndpoints = [
    { path: '/api/trips',     label: 'Trips' },
    { path: '/api/vendors',   label: 'Vendors' },
    { path: '/api/clients',   label: 'Clients' },
    { path: '/api/documents', label: 'Documents' },
    { path: '/api/bookings',  label: 'Bookings' },
    { path: '/api/dashboard', label: 'Dashboard' },
    { path: '/api/analytics', label: 'Analytics' },
    { path: '/api/user',      label: 'User' },
  ];

  for (const ep of jsonEndpoints) {
    const { res, body } = await safeFetch(`${BASE_URL}${ep.path}`);
    const ct = res.headers.get('content-type') || '';
    const isJson = ct.includes('application/json');
    const has401Body = body?.error === 'Unauthorized';

    report(
      `${ep.label} 401 returns JSON with { error: "Unauthorized" }`,
      isJson && has401Body && res.status === 401,
      `ct=${ct}, status=${res.status}, body=${JSON.stringify(body)}`
    );
  }
}

// ────────────────────────────────────────────────────────────
// RUN ALL TESTS
// ────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nFunctional CRUD Tests — Travel Manager`);
  console.log(`Target: ${BASE_URL}\n`);

  // Quick connectivity check
  try {
    await fetch(`${BASE_URL}/api/trips`, { signal: AbortSignal.timeout(5000) });
  } catch (err) {
    console.error(`Cannot reach ${BASE_URL}. Is the dev server running?\n`);
    console.error(`  Error: ${err.message}\n`);
    process.exit(1);
  }

  console.log('--- Running Tests ---');

  await testTripsApi();
  await testVendorsApi();
  await testClientsApi();
  await testBookingsApi();
  await testDocumentsApi();
  await testDashboardAnalyticsSearch();
  await testUserApi();
  await testStandaloneSubResources();
  await testResponseStructure();

  console.log('\n--- Summary ---');
  console.log(`  Total: ${passed + failed}`);
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);

  if (failed > 0) {
    console.log('\n  Failed tests:');
    for (const r of results) {
      if (r.status === 'FAIL') {
        console.log(`    - ${r.name}${r.detail ? ' (' + r.detail + ')' : ''}`);
      }
    }
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
