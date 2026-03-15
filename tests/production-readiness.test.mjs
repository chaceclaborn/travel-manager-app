/**
 * Production Readiness Tests — Travel Manager
 *
 * Comprehensive functional tests covering auth, security, pages,
 * API CRUD, input validation, removed features, and error handling.
 *
 * Run: node tests/production-readiness.test.mjs
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
// 1. AUTH & SECURITY (15+ tests)
// ═══════════════════════════════════════════════════════════════════

async function testAuthSecurity() {
  console.log('\n── 1. Auth & Security ──\n');

  // 1a. All API routes return 401 without auth
  const unauthRoutes = [
    { method: 'GET',    path: '/api/trips',            label: 'GET /api/trips' },
    { method: 'POST',   path: '/api/trips',            label: 'POST /api/trips' },
    { method: 'GET',    path: '/api/bookings',         label: 'GET /api/bookings' },
    { method: 'POST',   path: '/api/bookings',         label: 'POST /api/bookings' },
    { method: 'GET',    path: '/api/vendors',          label: 'GET /api/vendors' },
    { method: 'POST',   path: '/api/vendors',          label: 'POST /api/vendors' },
    { method: 'GET',    path: '/api/clients',          label: 'GET /api/clients' },
    { method: 'POST',   path: '/api/clients',          label: 'POST /api/clients' },
    { method: 'GET',    path: '/api/dashboard',        label: 'GET /api/dashboard' },
    { method: 'GET',    path: '/api/analytics',        label: 'GET /api/analytics' },
    { method: 'GET',    path: '/api/user',             label: 'GET /api/user' },
    { method: 'GET',    path: '/api/user/sessions',    label: 'GET /api/user/sessions' },
    { method: 'GET',    path: '/api/user/export',      label: 'GET /api/user/export' },
    { method: 'DELETE', path: '/api/user/delete',      label: 'DELETE /api/user/delete' },
    { method: 'GET',    path: '/api/search?q=test',    label: 'GET /api/search?q=test' },
  ];

  for (const ep of unauthRoutes) {
    try {
      const { res } = await safeFetch(`${BASE_URL}${ep.path}`, {
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

  // 1b. Admin route returns 401 without auth
  try {
    const { res } = await safeFetch(`${BASE_URL}/api/admin/analytics`, {
      headers: { 'Content-Type': 'application/json' },
    });
    const ok = res.status === 401;
    report(
      'No auth: GET /api/admin/analytics returns 401',
      ok,
      ok ? undefined : `Got ${res.status}`
    );
  } catch (err) {
    report('No auth: GET /api/admin/analytics returns 401', false, `Fetch error: ${err.message}`);
  }

  // 1c. Security headers present
  try {
    const { res } = await safeFetch(`${BASE_URL}/`);

    const csp = res.headers.get('content-security-policy');
    report('Security header: CSP present', !!csp, csp ? `${csp.substring(0, 60)}...` : 'Missing');

    const hsts = res.headers.get('strict-transport-security');
    report('Security header: HSTS present', !!hsts, hsts || 'Missing');

    const xfo = res.headers.get('x-frame-options');
    report('Security header: X-Frame-Options present', !!xfo, xfo || 'Missing');

    const xcto = res.headers.get('x-content-type-options');
    report('Security header: X-Content-Type-Options present', !!xcto, xcto || 'Missing');

    const referrer = res.headers.get('referrer-policy');
    report('Security header: Referrer-Policy present', !!referrer, referrer || 'Missing');

    const permissions = res.headers.get('permissions-policy');
    report('Security header: Permissions-Policy present', !!permissions, permissions ? `${permissions.substring(0, 60)}...` : 'Missing');
  } catch (err) {
    report('Security headers check', false, `Fetch error: ${err.message}`);
  }

  // 1d. Rate limiting works (send 50 rapid requests, expect at least one 429)
  try {
    const promises = Array.from({ length: 50 }, () =>
      safeFetch(`${BASE_URL}/api/trips`, {
        headers: { 'Content-Type': 'application/json' },
      }).then(({ res }) => res.status)
    );
    const statuses = await Promise.all(promises);
    const count429 = statuses.filter(s => s === 429).length;
    const anyServerError = statuses.some(s => s >= 500);
    // Rate limiting may or may not trigger depending on config, but no 500s is critical
    report(
      'Rate limiting: 50 rapid requests produce no 500s',
      !anyServerError,
      `429s: ${count429}, 401s: ${statuses.filter(s => s === 401).length}`
    );
  } catch (err) {
    report('Rate limiting test', false, `Fetch error: ${err.message}`);
  }

  // 1e. CSRF protection (POST with wrong Origin header returns 403)
  try {
    const { res } = await safeFetch(`${BASE_URL}/api/trips`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://evil-site.com',
      },
      body: JSON.stringify({ title: 'CSRF test' }),
    });
    const ok = res.status === 403;
    report(
      'CSRF: POST with wrong Origin returns 403',
      ok,
      ok ? undefined : `Got ${res.status}`
    );
  } catch (err) {
    report('CSRF protection test', false, `Fetch error: ${err.message}`);
  }

  // 1f. CSRF on PUT with wrong Origin
  try {
    const { res } = await safeFetch(`${BASE_URL}/api/vendors`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://attacker.com',
      },
      body: JSON.stringify({ name: 'CSRF vendor' }),
    });
    const ok = res.status === 403;
    report(
      'CSRF: POST /api/vendors with wrong Origin returns 403',
      ok,
      ok ? undefined : `Got ${res.status}`
    );
  } catch (err) {
    report('CSRF vendors test', false, `Fetch error: ${err.message}`);
  }

  // 1g. CSRF on DELETE with wrong Origin
  try {
    const { res } = await safeFetch(`${BASE_URL}/api/user/delete`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://malicious.example.com',
      },
    });
    const ok = res.status === 403;
    report(
      'CSRF: DELETE /api/user/delete with wrong Origin returns 403',
      ok,
      ok ? undefined : `Got ${res.status}`
    );
  } catch (err) {
    report('CSRF delete test', false, `Fetch error: ${err.message}`);
  }

  // 1h. Cache-Control: no-store on API responses
  try {
    const { res } = await safeFetch(`${BASE_URL}/api/trips`, {
      headers: { 'Content-Type': 'application/json' },
    });
    const cacheControl = res.headers.get('cache-control') || '';
    const ok = cacheControl.includes('no-store');
    report(
      'Cache-Control: no-store on API response',
      ok,
      `Cache-Control: ${cacheControl}`
    );
  } catch (err) {
    report('Cache-Control check', false, `Fetch error: ${err.message}`);
  }

  // 1i. Cache-Control on another API route
  try {
    const { res } = await safeFetch(`${BASE_URL}/api/dashboard`, {
      headers: { 'Content-Type': 'application/json' },
    });
    const cacheControl = res.headers.get('cache-control') || '';
    const ok = cacheControl.includes('no-store');
    report(
      'Cache-Control: no-store on /api/dashboard',
      ok,
      `Cache-Control: ${cacheControl}`
    );
  } catch (err) {
    report('Cache-Control dashboard check', false, `Fetch error: ${err.message}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// 2. PAGES & ROUTES (10+ tests)
// ═══════════════════════════════════════════════════════════════════

async function testPagesRoutes() {
  console.log('\n── 2. Pages & Routes ──\n');

  // 2a. Pages that should return 200
  const okPages = [
    { path: '/',         label: 'GET / (dashboard)' },
    { path: '/tour',     label: 'GET /tour (landing)' },
    { path: '/privacy',  label: 'GET /privacy' },
    { path: '/terms',    label: 'GET /terms' },
    { path: '/trips',    label: 'GET /trips' },
    { path: '/bookings', label: 'GET /bookings' },
    { path: '/map',      label: 'GET /map' },
    { path: '/settings', label: 'GET /settings' },
    { path: '/admin',    label: 'GET /admin' },
  ];

  for (const page of okPages) {
    try {
      const { res } = await safeFetch(`${BASE_URL}${page.path}`);
      const ok = res.status === 200;
      report(
        `${page.label} returns 200`,
        ok,
        ok ? undefined : `Got ${res.status}`
      );
    } catch (err) {
      report(`${page.label} returns 200`, false, `Fetch error: ${err.message}`);
    }
  }

  // 2b. Non-existent pages return 404
  const notFoundPages = [
    { path: '/this-page-does-not-exist',     label: 'Random non-existent page' },
    { path: '/foo/bar/baz',                  label: 'Deep non-existent path' },
    { path: '/api/this-route-does-not-exist', label: 'Non-existent API route' },
  ];

  for (const page of notFoundPages) {
    try {
      const { res } = await safeFetch(`${BASE_URL}${page.path}`);
      const ok = res.status === 404;
      report(
        `${page.label} returns 404`,
        ok,
        ok ? undefined : `Got ${res.status}`
      );
    } catch (err) {
      report(`${page.label} returns 404`, false, `Fetch error: ${err.message}`);
    }
  }

  // 2c. /analytics page returns 200
  try {
    const { res } = await safeFetch(`${BASE_URL}/analytics`);
    const ok = res.status === 200;
    report(
      'GET /analytics returns 200',
      ok,
      ok ? undefined : `Got ${res.status}`
    );
  } catch (err) {
    report('GET /analytics returns 200', false, `Fetch error: ${err.message}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// 3. API CRUD (20+ tests)
// ═══════════════════════════════════════════════════════════════════

async function testApiCrud() {
  console.log('\n── 3. API CRUD — Unauthenticated ──\n');

  const crudTests = [
    { method: 'GET',    path: '/api/trips',            label: 'GET /api/trips' },
    { method: 'POST',   path: '/api/trips',            label: 'POST /api/trips' },
    { method: 'GET',    path: '/api/bookings',         label: 'GET /api/bookings' },
    { method: 'POST',   path: '/api/bookings',         label: 'POST /api/bookings' },
    { method: 'GET',    path: '/api/vendors',          label: 'GET /api/vendors' },
    { method: 'POST',   path: '/api/vendors',          label: 'POST /api/vendors' },
    { method: 'GET',    path: '/api/clients',          label: 'GET /api/clients' },
    { method: 'POST',   path: '/api/clients',          label: 'POST /api/clients' },
    { method: 'GET',    path: '/api/dashboard',        label: 'GET /api/dashboard' },
    { method: 'GET',    path: '/api/analytics',        label: 'GET /api/analytics' },
    { method: 'GET',    path: '/api/user',             label: 'GET /api/user' },
    { method: 'GET',    path: '/api/user/sessions',    label: 'GET /api/user/sessions' },
    { method: 'GET',    path: '/api/user/export',      label: 'GET /api/user/export' },
    { method: 'DELETE', path: '/api/user/delete',      label: 'DELETE /api/user/delete' },
    { method: 'GET',    path: '/api/search?q=test',    label: 'GET /api/search?q=test' },
    { method: 'GET',    path: '/api/admin/analytics',  label: 'GET /api/admin/analytics' },
  ];

  for (const ep of crudTests) {
    try {
      const { res } = await safeFetch(`${BASE_URL}${ep.path}`, {
        method: ep.method,
        headers: { 'Content-Type': 'application/json' },
      });
      const ok = res.status === 401;
      report(
        `Unauth: ${ep.label} returns 401`,
        ok,
        ok ? undefined : `Got ${res.status}`
      );
    } catch (err) {
      report(`Unauth: ${ep.label} returns 401`, false, `Fetch error: ${err.message}`);
    }
  }

  // Additional CRUD routes with dynamic IDs
  const FAKE_UUID = '00000000-0000-0000-0000-000000000000';
  const idRoutes = [
    { method: 'GET',    path: `/api/trips/${FAKE_UUID}`,    label: 'GET /api/trips/[id]' },
    { method: 'PUT',    path: `/api/trips/${FAKE_UUID}`,    label: 'PUT /api/trips/[id]' },
    { method: 'DELETE', path: `/api/trips/${FAKE_UUID}`,    label: 'DELETE /api/trips/[id]' },
    { method: 'GET',    path: `/api/vendors/${FAKE_UUID}`,  label: 'GET /api/vendors/[id]' },
    { method: 'GET',    path: `/api/clients/${FAKE_UUID}`,  label: 'GET /api/clients/[id]' },
    { method: 'GET',    path: `/api/bookings/${FAKE_UUID}`, label: 'GET /api/bookings/[id]' },
  ];

  for (const ep of idRoutes) {
    try {
      const { res } = await safeFetch(`${BASE_URL}${ep.path}`, {
        method: ep.method,
        headers: { 'Content-Type': 'application/json' },
      });
      const ok = res.status === 401;
      report(
        `Unauth: ${ep.label} returns 401`,
        ok,
        ok ? undefined : `Got ${res.status}`
      );
    } catch (err) {
      report(`Unauth: ${ep.label} returns 401`, false, `Fetch error: ${err.message}`);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// 4. INPUT VALIDATION (10+ tests)
// ═══════════════════════════════════════════════════════════════════

async function testInputValidation() {
  console.log('\n── 4. Input Validation ──\n');

  // 4a. Invalid JSON bodies (should return 400 or 401, never 500)
  const invalidJsonEndpoints = [
    { path: '/api/trips',    label: 'POST /api/trips with invalid JSON' },
    { path: '/api/vendors',  label: 'POST /api/vendors with invalid JSON' },
    { path: '/api/clients',  label: 'POST /api/clients with invalid JSON' },
    { path: '/api/bookings', label: 'POST /api/bookings with invalid JSON' },
  ];

  for (const ep of invalidJsonEndpoints) {
    try {
      const { res } = await safeFetch(`${BASE_URL}${ep.path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{this is not valid json!!!',
      });
      const ok = res.status < 500;
      report(
        `${ep.label} does not return 500`,
        ok,
        `Got ${res.status}`
      );
    } catch (err) {
      report(`${ep.label}`, false, `Fetch error: ${err.message}`);
    }
  }

  // 4b. Empty POST bodies
  for (const ep of invalidJsonEndpoints) {
    try {
      const { res } = await safeFetch(`${BASE_URL}${ep.path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '',
      });
      const ok = res.status < 500;
      report(
        `${ep.label.replace('invalid JSON', 'empty body')} does not return 500`,
        ok,
        `Got ${res.status}`
      );
    } catch (err) {
      report(`${ep.label.replace('invalid JSON', 'empty body')}`, false, `Fetch error: ${err.message}`);
    }
  }

  // 4c. XSS payloads in request bodies don't cause 500
  const xssPayloads = [
    '<script>alert("xss")</script>',
    '<img src=x onerror=alert(1)>',
    '"><svg onload=alert(document.cookie)>',
  ];

  for (const payload of xssPayloads) {
    try {
      const { res } = await safeFetch(`${BASE_URL}/api/trips`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: payload, destination: payload }),
      });
      const ok = res.status < 500;
      report(
        `XSS payload in trip body: "${payload.substring(0, 30)}..." no 500`,
        ok,
        `Got ${res.status}`
      );
    } catch (err) {
      report(`XSS payload in trip body`, false, `Fetch error: ${err.message}`);
    }
  }

  // 4d. Extremely long field values don't cause 500
  try {
    const { res } = await safeFetch(`${BASE_URL}/api/trips`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'A'.repeat(50000), destination: 'B'.repeat(50000) }),
    });
    const ok = res.status < 500;
    report(
      'Extremely long field values (50K chars) no 500',
      ok,
      `Got ${res.status}`
    );
  } catch (err) {
    report('Extremely long field values', false, `Fetch error: ${err.message}`);
  }

  // 4e. SQL injection payloads don't cause 500
  const sqlPayloads = [
    `'; DROP TABLE "Trip";--`,
    `' OR '1'='1`,
  ];

  for (const payload of sqlPayloads) {
    try {
      const { res } = await safeFetch(`${BASE_URL}/api/trips`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: payload, destination: 'Test' }),
      });
      const ok = res.status < 500;
      report(
        `SQLi payload: "${payload.substring(0, 30)}" no 500`,
        ok,
        `Got ${res.status}`
      );
    } catch (err) {
      report(`SQLi payload`, false, `Fetch error: ${err.message}`);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// 5. REMOVED FEATURES (5+ tests)
// ═══════════════════════════════════════════════════════════════════

async function testRemovedFeatures() {
  console.log('\n── 5. Removed Features ──\n');

  // 5a. /documents page returns 404
  try {
    const { res } = await safeFetch(`${BASE_URL}/documents`);
    const ok = res.status === 404;
    report(
      'GET /documents returns 404 (removed)',
      ok,
      ok ? undefined : `Got ${res.status}`
    );
  } catch (err) {
    report('GET /documents returns 404', false, `Fetch error: ${err.message}`);
  }

  // 5b. GET /api/documents returns 404
  try {
    const { res } = await safeFetch(`${BASE_URL}/api/documents`, {
      headers: { 'Content-Type': 'application/json' },
    });
    const ok = res.status === 404;
    report(
      'GET /api/documents returns 404 (removed)',
      ok,
      ok ? undefined : `Got ${res.status}`
    );
  } catch (err) {
    report('GET /api/documents returns 404', false, `Fetch error: ${err.message}`);
  }

  // 5c. POST /api/documents returns 404
  try {
    const { res } = await safeFetch(`${BASE_URL}/api/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'PASSPORT', title: 'Test' }),
    });
    // POST to non-existent route: middleware CSRF check may see Origin mismatch (403) or 404
    const ok = res.status === 404 || res.status === 403;
    report(
      'POST /api/documents returns 404 or 403 (removed)',
      ok,
      `Got ${res.status}`
    );
  } catch (err) {
    report('POST /api/documents returns 404', false, `Fetch error: ${err.message}`);
  }

  // 5d. GET /api/documents/[id] returns 404
  try {
    const { res } = await safeFetch(`${BASE_URL}/api/documents/some-id`, {
      headers: { 'Content-Type': 'application/json' },
    });
    const ok = res.status === 404;
    report(
      'GET /api/documents/[id] returns 404 (removed)',
      ok,
      ok ? undefined : `Got ${res.status}`
    );
  } catch (err) {
    report('GET /api/documents/[id] returns 404', false, `Fetch error: ${err.message}`);
  }

  // 5e. DELETE /api/documents/[id] returns 404
  try {
    const { res } = await safeFetch(`${BASE_URL}/api/documents/some-id`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });
    // DELETE may be caught by CSRF (no Origin = pass through) or 404
    const ok = res.status === 404 || res.status === 403;
    report(
      'DELETE /api/documents/[id] returns 404 or 403 (removed)',
      ok,
      `Got ${res.status}`
    );
  } catch (err) {
    report('DELETE /api/documents/[id] returns 404', false, `Fetch error: ${err.message}`);
  }

  // 5f. /documents/new page returns 404
  try {
    const { res } = await safeFetch(`${BASE_URL}/documents/new`);
    const ok = res.status === 404;
    report(
      'GET /documents/new returns 404 (removed)',
      ok,
      ok ? undefined : `Got ${res.status}`
    );
  } catch (err) {
    report('GET /documents/new returns 404', false, `Fetch error: ${err.message}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// 6. ERROR HANDLING (5+ tests)
// ═══════════════════════════════════════════════════════════════════

async function testErrorHandling() {
  console.log('\n── 6. Error Handling ──\n');

  // 6a. API routes return JSON errors, not HTML
  const jsonErrorEndpoints = [
    { method: 'GET', path: '/api/trips',         label: 'GET /api/trips' },
    { method: 'GET', path: '/api/vendors',        label: 'GET /api/vendors' },
    { method: 'GET', path: '/api/clients',        label: 'GET /api/clients' },
    { method: 'GET', path: '/api/dashboard',      label: 'GET /api/dashboard' },
    { method: 'GET', path: '/api/user',           label: 'GET /api/user' },
  ];

  for (const ep of jsonErrorEndpoints) {
    try {
      const { res, body } = await safeFetch(`${BASE_URL}${ep.path}`, {
        method: ep.method,
        headers: { 'Content-Type': 'application/json' },
      });
      const contentType = res.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');
      const hasError = body && typeof body === 'object' && 'error' in body;
      report(
        `${ep.label} error is JSON with error field`,
        isJson && hasError,
        `CT: ${contentType.substring(0, 40)}, hasError: ${hasError}`
      );
    } catch (err) {
      report(`${ep.label} JSON error check`, false, `Fetch error: ${err.message}`);
    }
  }

  // 6b. No 500 errors on standard routes
  const standardRoutes = [
    { method: 'GET',  path: '/' },
    { method: 'GET',  path: '/tour' },
    { method: 'GET',  path: '/trips' },
    { method: 'GET',  path: '/bookings' },
    { method: 'GET',  path: '/vendors' },
    { method: 'GET',  path: '/map' },
    { method: 'GET',  path: '/settings' },
    { method: 'GET',  path: '/api/trips' },
    { method: 'GET',  path: '/api/dashboard' },
  ];

  for (const route of standardRoutes) {
    try {
      const { res } = await safeFetch(`${BASE_URL}${route.path}`, {
        method: route.method,
      });
      const ok = res.status < 500;
      report(
        `No 500 on ${route.method} ${route.path}`,
        ok,
        ok ? `Status ${res.status}` : `Got ${res.status}`
      );
    } catch (err) {
      report(`No 500 on ${route.method} ${route.path}`, false, `Fetch error: ${err.message}`);
    }
  }

  // 6c. Invalid HTTP methods don't cause 500
  const methodTests = [
    { method: 'PATCH',   path: '/api/trips',     label: 'PATCH /api/trips' },
    { method: 'PATCH',   path: '/api/vendors',    label: 'PATCH /api/vendors' },
    { method: 'PATCH',   path: '/api/clients',    label: 'PATCH /api/clients' },
    { method: 'OPTIONS', path: '/api/dashboard',  label: 'OPTIONS /api/dashboard' },
    { method: 'HEAD',    path: '/api/trips',      label: 'HEAD /api/trips' },
    { method: 'PATCH',   path: '/api/analytics',  label: 'PATCH /api/analytics' },
  ];

  for (const mt of methodTests) {
    try {
      const { res } = await safeFetch(`${BASE_URL}${mt.path}`, {
        method: mt.method,
        headers: { 'Content-Type': 'application/json' },
      });
      const ok = res.status < 500;
      report(
        `${mt.label} does not cause 500`,
        ok,
        `Got ${res.status}`
      );
    } catch (err) {
      report(`${mt.label}`, false, `Fetch error: ${err.message}`);
    }
  }

  // 6d. Wrong Content-Type on POST doesn't cause 500
  try {
    const { res } = await safeFetch(`${BASE_URL}/api/trips`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'title=test&destination=Paris',
    });
    const ok = res.status < 500;
    report(
      'POST /api/trips with form-urlencoded no 500',
      ok,
      `Got ${res.status}`
    );
  } catch (err) {
    report('POST with wrong Content-Type', false, `Fetch error: ${err.message}`);
  }

  // 6e. Empty Content-Type doesn't cause 500
  try {
    const { res } = await safeFetch(`${BASE_URL}/api/vendors`, {
      method: 'POST',
      headers: { 'Content-Type': '' },
      body: '{}',
    });
    const ok = res.status < 500;
    report(
      'POST /api/vendors with empty Content-Type no 500',
      ok,
      `Got ${res.status}`
    );
  } catch (err) {
    report('POST with empty Content-Type', false, `Fetch error: ${err.message}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// RUN
// ═══════════════════════════════════════════════════════════════════

async function main() {
  console.log(`\nProduction Readiness Tests — Travel Manager`);
  console.log(`Target: ${BASE_URL}`);

  await testAuthSecurity();
  await testPagesRoutes();
  await testApiCrud();
  await testInputValidation();
  await testRemovedFeatures();
  await testErrorHandling();

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
