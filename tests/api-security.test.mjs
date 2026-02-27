const BASE_URL = 'http://localhost:3000';
const FAKE_ID = 'test-id-123';

const endpoints = [
  // Trips
  { method: 'GET',    path: '/api/travelmanager/trips' },
  { method: 'POST',   path: '/api/travelmanager/trips' },
  { method: 'GET',    path: `/api/travelmanager/trips/${FAKE_ID}` },
  { method: 'PUT',    path: `/api/travelmanager/trips/${FAKE_ID}` },
  { method: 'DELETE', path: `/api/travelmanager/trips/${FAKE_ID}` },

  // Trip sub-resources
  { method: 'GET',    path: `/api/travelmanager/trips/${FAKE_ID}/vendors` },
  { method: 'POST',   path: `/api/travelmanager/trips/${FAKE_ID}/vendors` },
  { method: 'GET',    path: `/api/travelmanager/trips/${FAKE_ID}/clients` },
  { method: 'POST',   path: `/api/travelmanager/trips/${FAKE_ID}/clients` },
  { method: 'GET',    path: `/api/travelmanager/trips/${FAKE_ID}/itinerary` },
  { method: 'POST',   path: `/api/travelmanager/trips/${FAKE_ID}/itinerary` },
  { method: 'GET',    path: `/api/travelmanager/trips/${FAKE_ID}/attachments` },
  { method: 'POST',   path: `/api/travelmanager/trips/${FAKE_ID}/attachments` },

  // Itinerary by ID
  { method: 'PUT',    path: `/api/travelmanager/itinerary/${FAKE_ID}` },
  { method: 'DELETE', path: `/api/travelmanager/itinerary/${FAKE_ID}` },

  // Attachments by ID
  { method: 'GET',    path: `/api/travelmanager/attachments/${FAKE_ID}` },
  { method: 'DELETE', path: `/api/travelmanager/attachments/${FAKE_ID}` },

  // Vendors
  { method: 'GET',    path: '/api/travelmanager/vendors' },
  { method: 'POST',   path: '/api/travelmanager/vendors' },
  { method: 'GET',    path: `/api/travelmanager/vendors/${FAKE_ID}` },
  { method: 'PUT',    path: `/api/travelmanager/vendors/${FAKE_ID}` },
  { method: 'DELETE', path: `/api/travelmanager/vendors/${FAKE_ID}` },

  // Clients
  { method: 'GET',    path: '/api/travelmanager/clients' },
  { method: 'POST',   path: '/api/travelmanager/clients' },
  { method: 'GET',    path: `/api/travelmanager/clients/${FAKE_ID}` },
  { method: 'PUT',    path: `/api/travelmanager/clients/${FAKE_ID}` },
  { method: 'DELETE', path: `/api/travelmanager/clients/${FAKE_ID}` },

  // Dashboard & Search
  { method: 'GET',    path: '/api/travelmanager/dashboard' },
  { method: 'GET',    path: '/api/travelmanager/search?q=test' },

  // User
  { method: 'GET',    path: '/api/travelmanager/user' },
  { method: 'GET',    path: '/api/travelmanager/user/export' },
  { method: 'DELETE', path: '/api/travelmanager/user/delete' },
  { method: 'GET',    path: '/api/travelmanager/user/sessions' },
  { method: 'GET',    path: '/api/travelmanager/user/summary?period=3months' },
];

let passed = 0;
let failed = 0;

console.log('Travel Manager API Security Tests');
console.log('==================================');
console.log('Verifying all endpoints return 401 without authentication\n');

for (const { method, path } of endpoints) {
  const label = `${method.padEnd(6)} ${path}`;
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
    });

    const status = res.status;
    let body;
    try {
      body = await res.json();
    } catch {
      body = null;
    }

    const statusOk = status === 401;
    const bodyOk = body && body.error === 'Unauthorized';

    if (statusOk && bodyOk) {
      console.log(`  PASS  ${label}`);
      passed++;
    } else {
      const reasons = [];
      if (!statusOk) reasons.push(`status=${status} (expected 401)`);
      if (!bodyOk) reasons.push(`body=${JSON.stringify(body)} (expected { error: 'Unauthorized' })`);
      console.log(`  FAIL  ${label} -- ${reasons.join(', ')}`);
      failed++;
    }
  } catch (err) {
    console.log(`  FAIL  ${label} -- ${err.message}`);
    failed++;
  }
}

console.log('\n==================================');
console.log(`Results: ${passed} passed, ${failed} failed out of ${endpoints.length} tests`);

if (failed > 0) {
  process.exit(1);
}
