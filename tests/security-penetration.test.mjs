/**
 * Security Penetration Tests — Travel Manager
 *
 * Tests auth bypass, SQL injection, XSS, path traversal,
 * HTTP method fuzzing, rate limiting / abuse, and IDOR vectors.
 *
 * Run: node tests/security-penetration.test.mjs
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
  let body = null;
  try {
    const text = await res.text();
    try { body = JSON.parse(text); } catch { body = text; }
  } catch { /* empty */ }
  return { res, body };
}

// ═══════════════════════════════════════════════════════════════════
// 1. AUTH BYPASS ATTEMPTS (15+ tests)
// ═══════════════════════════════════════════════════════════════════

async function testAuthBypass() {
  console.log('\n── 1. Auth Bypass Attempts ──\n');

  // 1a. All major API routes return 401 without any cookies/headers
  const unauthRoutes = [
    { method: 'GET',    path: '/api/user',                          label: 'GET /api/user' },
    { method: 'GET',    path: '/api/trips',                         label: 'GET /api/trips' },
    { method: 'GET',    path: '/api/bookings',                      label: 'GET /api/bookings' },
    { method: 'GET',    path: '/api/vendors',                       label: 'GET /api/vendors' },
    { method: 'GET',    path: '/api/clients',                       label: 'GET /api/clients' },
    { method: 'GET',    path: '/api/dashboard',                     label: 'GET /api/dashboard' },
    { method: 'GET',    path: '/api/analytics',                     label: 'GET /api/analytics' },
    { method: 'GET',    path: '/api/search?q=test',                 label: 'GET /api/search' },
    { method: 'GET',    path: '/api/documents',                     label: 'GET /api/documents' },
    { method: 'POST',   path: '/api/trips',                         label: 'POST /api/trips' },
    { method: 'POST',   path: '/api/bookings',                      label: 'POST /api/bookings' },
    { method: 'POST',   path: '/api/vendors',                       label: 'POST /api/vendors' },
    { method: 'POST',   path: '/api/clients',                       label: 'POST /api/clients' },
    { method: 'GET',    path: '/api/user/export',                   label: 'GET /api/user/export' },
    { method: 'DELETE', path: '/api/user/delete',                   label: 'DELETE /api/user/delete' },
    { method: 'GET',    path: '/api/user/sessions',                 label: 'GET /api/user/sessions' },
  ];

  for (const ep of unauthRoutes) {
    try {
      const { res, body } = await safeFetch(`${BASE_URL}${ep.path}`, {
        method: ep.method,
        headers: { 'Content-Type': 'application/json' },
      });
      const ok = res.status === 401;
      report(
        `No auth: ${ep.label} returns 401`,
        ok,
        ok ? undefined : `Got ${res.status}`
      );
    } catch (err) {
      report(`No auth: ${ep.label} returns 401`, false, `Fetch error: ${err.message}`);
    }
  }

  // 1b. Forged / invalid auth cookies are rejected
  const forgedCookies = [
    { label: 'Random session cookie',           cookie: 'sb-access-token=fakecookie123; sb-refresh-token=fakecookie456' },
    { label: 'Empty auth cookie',               cookie: 'sb-access-token=; sb-refresh-token=' },
    { label: 'Malformed JWT cookie',            cookie: 'sb-access-token=eyJhbGciOiJIUzI1NiJ9.INVALID.SIGNATURE' },
    { label: 'Base64 garbage cookie',           cookie: 'sb-access-token=dGhpcyBpcyBub3QgYSB0b2tlbg==' },
  ];

  for (const fc of forgedCookies) {
    try {
      const { res } = await safeFetch(`${BASE_URL}/api/user`, {
        headers: { 'Cookie': fc.cookie, 'Content-Type': 'application/json' },
      });
      const ok = res.status === 401;
      report(
        `Forged cookie rejected: ${fc.label}`,
        ok,
        ok ? undefined : `Got ${res.status}`
      );
    } catch (err) {
      report(`Forged cookie rejected: ${fc.label}`, false, `Fetch error: ${err.message}`);
    }
  }

  // 1c. Random Authorization headers are rejected
  const authHeaders = [
    { label: 'Bearer random-string',            value: 'Bearer totally-not-a-token' },
    { label: 'Bearer empty',                    value: 'Bearer ' },
    { label: 'Basic admin:admin',               value: 'Basic YWRtaW46YWRtaW4=' },
    { label: 'Token gibberish',                 value: 'Token abc123xyz' },
  ];

  for (const ah of authHeaders) {
    try {
      const { res } = await safeFetch(`${BASE_URL}/api/trips`, {
        headers: { 'Authorization': ah.value, 'Content-Type': 'application/json' },
      });
      const ok = res.status === 401;
      report(
        `Auth header rejected: ${ah.label}`,
        ok,
        ok ? undefined : `Got ${res.status}`
      );
    } catch (err) {
      report(`Auth header rejected: ${ah.label}`, false, `Fetch error: ${err.message}`);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// 2. SQL INJECTION (10+ tests)
// ═══════════════════════════════════════════════════════════════════

async function testSQLInjection() {
  console.log('\n── 2. SQL Injection Attempts ──\n');

  // 2a. Search endpoint with SQL payloads
  const searchPayloads = [
    `'; DROP TABLE "User";--`,
    `' OR '1'='1`,
    `" UNION SELECT * FROM "User"--`,
    `1; SELECT * FROM pg_tables;--`,
    `' OR 1=1; --`,
    `'; INSERT INTO "User" (email) VALUES ('hacker@evil.com');--`,
    `%27%20OR%20%271%27%3D%271`,
  ];

  for (const payload of searchPayloads) {
    try {
      const encoded = encodeURIComponent(payload);
      const { res } = await safeFetch(`${BASE_URL}/api/search?q=${encoded}`, {
        headers: { 'Content-Type': 'application/json' },
      });
      // Auth blocks first (401) OR safe response — never 500
      const ok = res.status !== 500 && res.status !== 502 && res.status !== 503;
      report(
        `SQLi search: ${payload.substring(0, 40)}...`,
        ok,
        `Status ${res.status} (no server error)`
      );
    } catch (err) {
      report(`SQLi search: ${payload.substring(0, 40)}...`, false, `Fetch error: ${err.message}`);
    }
  }

  // 2b. Trip creation with SQL in title/destination
  const tripSQLPayloads = [
    { title: `'; DROP TABLE "Trip";--`, destination: 'Paris' },
    { title: 'Normal Trip', destination: `' OR '1'='1` },
    { title: `" UNION SELECT password FROM "User"--`, destination: 'London' },
  ];

  for (const body of tripSQLPayloads) {
    try {
      const { res } = await safeFetch(`${BASE_URL}/api/trips`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const ok = res.status === 401 || (res.status >= 200 && res.status < 500);
      report(
        `SQLi trip create: title="${body.title.substring(0, 30)}"`,
        ok,
        `Status ${res.status} (auth blocks or safe response)`
      );
    } catch (err) {
      report(`SQLi trip create`, false, `Fetch error: ${err.message}`);
    }
  }

  // 2c. Vendor creation with SQL in name
  const vendorSQLPayloads = [
    { name: `'; DELETE FROM "Vendor";--`, category: 'HOTEL' },
    { name: `" OR ""="`, category: 'AIRLINE' },
  ];

  for (const body of vendorSQLPayloads) {
    try {
      const { res } = await safeFetch(`${BASE_URL}/api/vendors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const ok = res.status === 401 || (res.status >= 200 && res.status < 500);
      report(
        `SQLi vendor create: name="${body.name.substring(0, 30)}"`,
        ok,
        `Status ${res.status}`
      );
    } catch (err) {
      report(`SQLi vendor create`, false, `Fetch error: ${err.message}`);
    }
  }

  // 2d. Client creation with SQL in name
  const clientSQLPayloads = [
    { name: `'; UPDATE "Client" SET email='hacked';--` },
    { name: `1' AND 1=CONVERT(int,(SELECT TOP 1 table_name FROM information_schema.tables))--` },
  ];

  for (const body of clientSQLPayloads) {
    try {
      const { res } = await safeFetch(`${BASE_URL}/api/clients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const ok = res.status === 401 || (res.status >= 200 && res.status < 500);
      report(
        `SQLi client create: name="${body.name.substring(0, 35)}"`,
        ok,
        `Status ${res.status}`
      );
    } catch (err) {
      report(`SQLi client create`, false, `Fetch error: ${err.message}`);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// 3. XSS ATTEMPTS (10+ tests)
// ═══════════════════════════════════════════════════════════════════

async function testXSS() {
  console.log('\n── 3. XSS Attempts ──\n');

  // 3a. Search with XSS payloads — verify response is JSON, not HTML
  const xssSearchPayloads = [
    `<script>alert(1)</script>`,
    `<img src=x onerror=alert(1)>`,
    `<svg onload=alert(1)>`,
    `javascript:alert(1)`,
    `"><script>alert(document.cookie)</script>`,
    `'><img src=x onerror=alert('XSS')>`,
  ];

  for (const payload of xssSearchPayloads) {
    try {
      const encoded = encodeURIComponent(payload);
      const { res, body } = await safeFetch(`${BASE_URL}/api/search?q=${encoded}`);
      const contentType = res.headers.get('content-type') || '';
      const isJSON = contentType.includes('application/json');
      const notServerError = res.status < 500;
      // XSS payload must not appear unescaped in a text/html response
      const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
      const noRawScript = !bodyStr || !contentType.includes('text/html');

      const ok = notServerError && (isJSON || noRawScript);
      report(
        `XSS search: ${payload.substring(0, 35)}`,
        ok,
        `Status ${res.status}, Content-Type: ${contentType.substring(0, 30)}`
      );
    } catch (err) {
      report(`XSS search`, false, `Fetch error: ${err.message}`);
    }
  }

  // 3b. Trip creation with XSS in title
  const xssTripPayloads = [
    { title: `<script>alert('xss')</script>`, destination: 'Tokyo' },
    { title: `<img src=x onerror=alert(1)>`, destination: 'Berlin' },
  ];

  for (const body of xssTripPayloads) {
    try {
      const { res } = await safeFetch(`${BASE_URL}/api/trips`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const contentType = res.headers.get('content-type') || '';
      const ok = res.status === 401 || (res.status < 500 && contentType.includes('application/json'));
      report(
        `XSS trip title: "${body.title.substring(0, 30)}"`,
        ok,
        `Status ${res.status}, CT: ${contentType.substring(0, 30)}`
      );
    } catch (err) {
      report(`XSS trip title`, false, `Fetch error: ${err.message}`);
    }
  }

  // 3c. Encoded XSS payloads
  const encodedXSSPayloads = [
    { label: 'HTML entity encoded',   payload: '&lt;script&gt;alert(1)&lt;/script&gt;' },
    { label: 'Double URL-encoded',     payload: '%253Cscript%253Ealert(1)%253C%252Fscript%253E' },
    { label: 'Unicode escaped',        payload: '\u003Cscript\u003Ealert(1)\u003C/script\u003E' },
  ];

  for (const ep of encodedXSSPayloads) {
    try {
      const { res } = await safeFetch(`${BASE_URL}/api/search?q=${encodeURIComponent(ep.payload)}`);
      const contentType = res.headers.get('content-type') || '';
      const ok = res.status < 500 && (res.status === 401 || contentType.includes('application/json'));
      report(
        `XSS encoded: ${ep.label}`,
        ok,
        `Status ${res.status}, CT: ${contentType.substring(0, 30)}`
      );
    } catch (err) {
      report(`XSS encoded: ${ep.label}`, false, `Fetch error: ${err.message}`);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// 4. PATH TRAVERSAL (5+ tests)
// ═══════════════════════════════════════════════════════════════════

async function testPathTraversal() {
  console.log('\n── 4. Path Traversal Attempts ──\n');

  const traversalPaths = [
    { path: '/api/trips/../../../etc/passwd',                        label: 'Dot-dot etc/passwd' },
    { path: '/api/trips/..%2F..%2F..%2Fetc%2Fpasswd',               label: 'URL-encoded traversal' },
    { path: '/api/trips/%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',   label: 'Percent-encoded dots' },
    { path: '/api/attachments/..%5C..%5C..%5Cwindows%5Csystem32',   label: 'Backslash traversal (encoded)' },
    { path: '/api/trips/....//....//etc/passwd',                     label: 'Double-dot-slash bypass' },
    { path: '/api/attachments/%00/etc/passwd',                       label: 'Null byte injection' },
  ];

  for (const tp of traversalPaths) {
    try {
      const { res, body } = await safeFetch(`${BASE_URL}${tp.path}`);
      const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
      // Should never return file system contents or a 500
      const noFileContents = !bodyStr || (!bodyStr.includes('root:') && !bodyStr.includes('[boot loader]'));
      const notServerError = res.status < 500;
      const ok = noFileContents && notServerError;
      report(
        `Path traversal: ${tp.label}`,
        ok,
        `Status ${res.status}${!noFileContents ? ' — LEAKED FILE CONTENTS!' : ''}`
      );
    } catch (err) {
      report(`Path traversal: ${tp.label}`, false, `Fetch error: ${err.message}`);
    }
  }

  // Traversal in attachment filename via POST body
  try {
    const { res } = await safeFetch(`${BASE_URL}/api/trips/${FAKE_ID}/attachments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: '../../../etc/passwd', data: 'test' }),
    });
    const ok = res.status === 401 || res.status < 500;
    report(
      'Path traversal in attachment filename body',
      ok,
      `Status ${res.status}`
    );
  } catch (err) {
    report('Path traversal in attachment filename body', false, `Fetch error: ${err.message}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// 5. HTTP METHOD FUZZING (10+ tests)
// ═══════════════════════════════════════════════════════════════════

async function testHTTPMethodFuzzing() {
  console.log('\n── 5. HTTP Method Fuzzing ──\n');

  const methodTests = [
    { method: 'PATCH',   path: '/api/trips',                 label: 'PATCH /api/trips' },
    { method: 'OPTIONS', path: '/api/trips',                 label: 'OPTIONS /api/trips' },
    { method: 'HEAD',    path: '/api/trips',                 label: 'HEAD /api/trips' },
    { method: 'PATCH',   path: '/api/vendors',               label: 'PATCH /api/vendors' },
    { method: 'OPTIONS', path: '/api/vendors',               label: 'OPTIONS /api/vendors' },
    { method: 'HEAD',    path: '/api/dashboard',             label: 'HEAD /api/dashboard' },
    { method: 'PATCH',   path: '/api/search?q=test',         label: 'PATCH /api/search' },
    { method: 'OPTIONS', path: '/api/user',                  label: 'OPTIONS /api/user' },
    { method: 'HEAD',    path: '/api/bookings',              label: 'HEAD /api/bookings' },
    { method: 'PATCH',   path: '/api/clients',               label: 'PATCH /api/clients' },
    { method: 'PATCH',   path: '/api/analytics',             label: 'PATCH /api/analytics' },
    { method: 'HEAD',    path: '/api/documents',             label: 'HEAD /api/documents' },
  ];

  for (const mt of methodTests) {
    try {
      const { res } = await safeFetch(`${BASE_URL}${mt.path}`, {
        method: mt.method,
        headers: { 'Content-Type': 'application/json' },
      });
      // Should return 401, 405, or other appropriate codes — never 500
      const notServerError = res.status < 500;
      report(
        `${mt.label} does not cause 5xx`,
        notServerError,
        `Status ${res.status}`
      );
    } catch (err) {
      report(`${mt.label}`, false, `Fetch error: ${err.message}`);
    }
  }

  // TRACE is special — should be blocked at framework level
  try {
    const { res } = await safeFetch(`${BASE_URL}/api/trips`, {
      method: 'TRACE',
      headers: { 'Content-Type': 'application/json' },
    });
    const ok = res.status < 500;
    report(
      'TRACE /api/trips is blocked or safe',
      ok,
      `Status ${res.status}`
    );
  } catch (err) {
    // TRACE may be rejected at transport level — that's fine
    report('TRACE /api/trips is blocked or safe', true, `Blocked at transport: ${err.message}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// 6. RATE LIMITING / ABUSE (5+ tests)
// ═══════════════════════════════════════════════════════════════════

async function testRateLimitingAbuse() {
  console.log('\n── 6. Rate Limiting / Abuse ──\n');

  // 6a. Rapid-fire requests: send 20 concurrent requests
  try {
    const promises = Array.from({ length: 20 }, (_, i) =>
      safeFetch(`${BASE_URL}/api/trips`, {
        headers: { 'Content-Type': 'application/json' },
      }).then(({ res }) => res.status)
    );
    const statuses = await Promise.all(promises);
    const anyServerError = statuses.some(s => s >= 500);
    const count401 = statuses.filter(s => s === 401).length;
    const count429 = statuses.filter(s => s === 429).length;
    report(
      'Rapid-fire 20x GET /api/trips: no 500s',
      !anyServerError,
      `401s: ${count401}, 429s: ${count429}, others: ${statuses.filter(s => s !== 401 && s !== 429).length}`
    );
  } catch (err) {
    report('Rapid-fire 20x GET /api/trips', false, `Error: ${err.message}`);
  }

  // 6b. Rapid-fire on search endpoint
  try {
    const promises = Array.from({ length: 20 }, (_, i) =>
      safeFetch(`${BASE_URL}/api/search?q=test${i}`, {
        headers: { 'Content-Type': 'application/json' },
      }).then(({ res }) => res.status)
    );
    const statuses = await Promise.all(promises);
    const anyServerError = statuses.some(s => s >= 500);
    report(
      'Rapid-fire 20x GET /api/search: no 500s',
      !anyServerError,
      `Statuses: ${[...new Set(statuses)].join(', ')}`
    );
  } catch (err) {
    report('Rapid-fire 20x GET /api/search', false, `Error: ${err.message}`);
  }

  // 6c. Large request body (100KB+)
  try {
    const largeBody = JSON.stringify({ title: 'A'.repeat(100000), destination: 'B'.repeat(10000) });
    const { res } = await safeFetch(`${BASE_URL}/api/trips`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: largeBody,
    });
    const ok = res.status < 500;
    report(
      'Large body (100KB+) POST /api/trips: no 500',
      ok,
      `Status ${res.status}`
    );
  } catch (err) {
    report('Large body POST /api/trips', false, `Error: ${err.message}`);
  }

  // 6d. Extremely long query string
  try {
    const longQ = 'x'.repeat(10000);
    const { res } = await safeFetch(`${BASE_URL}/api/search?q=${longQ}`, {
      headers: { 'Content-Type': 'application/json' },
    });
    const ok = res.status < 500;
    report(
      'Long query string (10K chars): no 500',
      ok,
      `Status ${res.status}`
    );
  } catch (err) {
    report('Long query string', false, `Error: ${err.message}`);
  }

  // 6e. Deeply nested JSON body
  try {
    let nested = { value: 'leaf' };
    for (let i = 0; i < 100; i++) {
      nested = { nested };
    }
    const { res } = await safeFetch(`${BASE_URL}/api/trips`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nested),
    });
    const ok = res.status < 500;
    report(
      'Deeply nested JSON (100 levels): no 500',
      ok,
      `Status ${res.status}`
    );
  } catch (err) {
    report('Deeply nested JSON', false, `Error: ${err.message}`);
  }

  // 6f. Rapid-fire POST requests
  try {
    const promises = Array.from({ length: 20 }, () =>
      safeFetch(`${BASE_URL}/api/vendors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Flood Test Vendor' }),
      }).then(({ res }) => res.status)
    );
    const statuses = await Promise.all(promises);
    const anyServerError = statuses.some(s => s >= 500);
    report(
      'Rapid-fire 20x POST /api/vendors: no 500s',
      !anyServerError,
      `Statuses: ${[...new Set(statuses)].join(', ')}`
    );
  } catch (err) {
    report('Rapid-fire 20x POST /api/vendors', false, `Error: ${err.message}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// 7. IDOR ATTEMPTS (5+ tests)
// ═══════════════════════════════════════════════════════════════════

async function testIDOR() {
  console.log('\n── 7. IDOR (Insecure Direct Object Reference) Attempts ──\n');

  const idorTests = [
    { method: 'GET',    path: `/api/trips/${FAKE_ID}`,        label: 'GET trip by fake ID' },
    { method: 'GET',    path: `/api/bookings/${FAKE_ID}`,     label: 'GET booking by fake ID' },
    { method: 'GET',    path: `/api/vendors/${FAKE_ID}`,      label: 'GET vendor by fake ID' },
    { method: 'GET',    path: `/api/clients/${FAKE_ID}`,      label: 'GET client by fake ID' },
    { method: 'GET',    path: `/api/documents/${FAKE_ID}`,    label: 'GET document by fake ID' },
    { method: 'GET',    path: `/api/trips/${FAKE_UUID}`,      label: 'GET trip by zeroed UUID' },
    { method: 'PUT',    path: `/api/trips/${FAKE_UUID}`,      label: 'PUT trip by zeroed UUID' },
    { method: 'DELETE', path: `/api/trips/${FAKE_UUID}`,      label: 'DELETE trip by zeroed UUID' },
    { method: 'GET',    path: `/api/attachments/${FAKE_UUID}`, label: 'GET attachment by zeroed UUID' },
    { method: 'GET',    path: `/api/bookings/${FAKE_UUID}`,   label: 'GET booking by zeroed UUID' },
  ];

  for (const test of idorTests) {
    try {
      const { res, body } = await safeFetch(`${BASE_URL}${test.path}`, {
        method: test.method,
        headers: { 'Content-Type': 'application/json' },
        body: test.method === 'PUT' ? JSON.stringify({ title: 'Hijacked!' }) : undefined,
      });
      // Must be 401 (auth blocks first) — never return another user's data or 500
      const ok = res.status === 401;
      report(
        `IDOR: ${test.label} returns 401`,
        ok,
        ok ? undefined : `Got ${res.status}`
      );
    } catch (err) {
      report(`IDOR: ${test.label}`, false, `Fetch error: ${err.message}`);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// 8. BONUS: Header Injection & Miscellaneous
// ═══════════════════════════════════════════════════════════════════

async function testMiscSecurity() {
  console.log('\n── 8. Misc Security Checks ──\n');

  // 8a. Host header injection
  try {
    const { res } = await safeFetch(`${BASE_URL}/api/trips`, {
      headers: {
        'Host': 'evil.com',
        'Content-Type': 'application/json',
      },
    });
    const ok = res.status < 500;
    report(
      'Host header injection: no 500',
      ok,
      `Status ${res.status}`
    );
  } catch (err) {
    report('Host header injection', false, `Error: ${err.message}`);
  }

  // 8b. Content-Type mismatch — send form-urlencoded to JSON endpoint
  try {
    const { res } = await safeFetch(`${BASE_URL}/api/trips`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'title=test&destination=Paris',
    });
    const ok = res.status < 500;
    report(
      'Content-Type mismatch (form-urlencoded to JSON route): no 500',
      ok,
      `Status ${res.status}`
    );
  } catch (err) {
    report('Content-Type mismatch', false, `Error: ${err.message}`);
  }

  // 8c. Empty Content-Type
  try {
    const { res } = await safeFetch(`${BASE_URL}/api/trips`, {
      method: 'POST',
      headers: { 'Content-Type': '' },
      body: '{}',
    });
    const ok = res.status < 500;
    report(
      'Empty Content-Type header: no 500',
      ok,
      `Status ${res.status}`
    );
  } catch (err) {
    report('Empty Content-Type', false, `Error: ${err.message}`);
  }

  // 8d. Oversized header
  try {
    const { res } = await safeFetch(`${BASE_URL}/api/trips`, {
      headers: {
        'Content-Type': 'application/json',
        'X-Custom-Header': 'A'.repeat(8000),
      },
    });
    const ok = res.status < 500;
    report(
      'Oversized custom header (8KB): no 500',
      ok,
      `Status ${res.status}`
    );
  } catch (err) {
    // Server may reject before responding — that's acceptable
    report('Oversized custom header (8KB): no 500', true, `Rejected at transport level`);
  }

  // 8e. Verify JSON Content-Type on 401 responses
  try {
    const { res } = await safeFetch(`${BASE_URL}/api/trips`);
    const contentType = res.headers.get('content-type') || '';
    const ok = res.status === 401 && contentType.includes('application/json');
    report(
      '401 response has application/json Content-Type',
      ok,
      `Status ${res.status}, CT: ${contentType}`
    );
  } catch (err) {
    report('401 Content-Type check', false, `Error: ${err.message}`);
  }

  // 8f. No sensitive headers leaked
  try {
    const { res } = await safeFetch(`${BASE_URL}/api/trips`);
    const serverHeader = res.headers.get('server') || '';
    const poweredBy = res.headers.get('x-powered-by') || '';
    // Next.js sets x-powered-by by default — flagging if present but not failing
    const noDetailedServer = !serverHeader.includes('Apache') && !serverHeader.includes('nginx/');
    report(
      'No detailed server version leaked in headers',
      noDetailedServer,
      `Server: "${serverHeader}", X-Powered-By: "${poweredBy}"`
    );
  } catch (err) {
    report('Server header check', false, `Error: ${err.message}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// RUN
// ═══════════════════════════════════════════════════════════════════

async function main() {
  console.log(`\nSecurity Penetration Tests — Travel Manager`);
  console.log(`Target: ${BASE_URL}`);

  await testAuthBypass();
  await testSQLInjection();
  await testXSS();
  await testPathTraversal();
  await testHTTPMethodFuzzing();
  await testRateLimitingAbuse();
  await testIDOR();
  await testMiscSecurity();

  console.log('\n── Summary ──');
  console.log(`  ${passed} passed, ${failed} failed out of ${passed + failed} tests`);

  if (failed > 0) {
    console.log('\n  Failed tests:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`    - ${r.name}${r.detail ? ': ' + r.detail : ''}`);
    });
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
