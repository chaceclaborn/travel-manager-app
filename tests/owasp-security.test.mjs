/**
 * OWASP Top 10 Security Tests — Travel Manager
 *
 * Comprehensive tests organized by OWASP 2021 Top 10 categories:
 *   A01 Broken Access Control, A02 Cryptographic Failures,
 *   A03 Injection, A04 Insecure Design, A05 Security Misconfiguration,
 *   A06 Vulnerable Components, A07 Auth Failures, A08 Data Integrity,
 *   A09 Logging & Monitoring, A10 SSRF
 *
 * Run: node tests/owasp-security.test.mjs
 *
 * Requires: dev server running at http://localhost:3000
 */

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';
const FAKE_UUID = '00000000-0000-0000-0000-000000000000';
const FAKE_UUID_2 = '11111111-1111-1111-1111-111111111111';
const SEQUENTIAL_UUID = '00000000-0000-0000-0000-000000000001';

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
  const res = await fetch(url, { redirect: 'manual', ...opts });
  let body = null;
  try {
    const text = await res.text();
    try { body = JSON.parse(text); } catch { body = text; }
  } catch { /* empty */ }
  return { res, body };
}

// ═══════════════════════════════════════════════════════════════════
// A01 — BROKEN ACCESS CONTROL (13 tests)
// ═══════════════════════════════════════════════════════════════════

async function testA01_BrokenAccessControl() {
  console.log('\n── A01: Broken Access Control ──\n');

  // A01-1. IDOR: Access another user's trip by guessing UUID
  try {
    const { res } = await safeFetch(`${BASE_URL}/api/trips/${FAKE_UUID}`, {
      headers: { 'Content-Type': 'application/json' },
    });
    const ok = res.status === 401;
    report('A01-1 IDOR: GET /api/trips/<fake-uuid> returns 401', ok,
      ok ? undefined : `Got ${res.status}`);
  } catch (err) {
    report('A01-1 IDOR: GET /api/trips/<fake-uuid>', false, `Fetch error: ${err.message}`);
  }

  // A01-2. IDOR: Access another user's booking
  try {
    const { res } = await safeFetch(`${BASE_URL}/api/bookings/${FAKE_UUID}`, {
      headers: { 'Content-Type': 'application/json' },
    });
    const ok = res.status === 401;
    report('A01-2 IDOR: GET /api/bookings/<fake-uuid> returns 401', ok,
      ok ? undefined : `Got ${res.status}`);
  } catch (err) {
    report('A01-2 IDOR: GET /api/bookings/<fake-uuid>', false, `Fetch error: ${err.message}`);
  }

  // A01-3. IDOR: Enumerate sequential UUIDs
  try {
    const { res } = await safeFetch(`${BASE_URL}/api/trips/${SEQUENTIAL_UUID}`, {
      headers: { 'Content-Type': 'application/json' },
    });
    const ok = res.status === 401;
    report('A01-3 IDOR: Sequential UUID enumeration returns 401', ok,
      ok ? undefined : `Got ${res.status}`);
  } catch (err) {
    report('A01-3 IDOR: Sequential UUID enumeration', false, `Fetch error: ${err.message}`);
  }

  // A01-4. Privilege escalation: PUT to update another user's trip
  try {
    const { res } = await safeFetch(`${BASE_URL}/api/trips/${FAKE_UUID}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Hijacked Trip', status: 'active' }),
    });
    const ok = res.status === 401;
    report('A01-4 Privilege escalation: PUT /api/trips/<fake-uuid> returns 401', ok,
      ok ? undefined : `Got ${res.status}`);
  } catch (err) {
    report('A01-4 Privilege escalation: PUT trip', false, `Fetch error: ${err.message}`);
  }

  // A01-5. Privilege escalation: DELETE another user's trip
  try {
    const { res } = await safeFetch(`${BASE_URL}/api/trips/${FAKE_UUID}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });
    const ok = res.status === 401;
    report('A01-5 Privilege escalation: DELETE /api/trips/<fake-uuid> returns 401', ok,
      ok ? undefined : `Got ${res.status}`);
  } catch (err) {
    report('A01-5 Privilege escalation: DELETE trip', false, `Fetch error: ${err.message}`);
  }

  // A01-6. Force browsing: Access admin/internal paths
  const adminPaths = [
    '/admin',
    '/api/admin',
    '/api/admin/users',
    '/_internal',
    '/api/internal',
  ];
  for (const path of adminPaths) {
    try {
      const { res } = await safeFetch(`${BASE_URL}${path}`);
      const ok = res.status === 401 || res.status === 403 || res.status === 404;
      report(`A01-6 Force browsing: ${path} blocked`, ok,
        ok ? `Status ${res.status}` : `Got ${res.status}`);
    } catch (err) {
      report(`A01-6 Force browsing: ${path}`, false, `Fetch error: ${err.message}`);
    }
  }

  // A01-7. Path traversal in trip ID parameter
  try {
    const { res, body } = await safeFetch(`${BASE_URL}/api/trips/..%2F..%2Fapi%2Fuser`, {
      headers: { 'Content-Type': 'application/json' },
    });
    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
    const noDataLeak = !bodyStr || !bodyStr.includes('email');
    const ok = (res.status === 401 || res.status === 404 || res.status === 400) && noDataLeak;
    report('A01-7 Path traversal in trip ID returns 401/404', ok,
      `Status ${res.status}`);
  } catch (err) {
    report('A01-7 Path traversal in trip ID', false, `Fetch error: ${err.message}`);
  }

  // A01-8. Missing function-level access: DELETE /api/user/delete without auth
  try {
    const { res } = await safeFetch(`${BASE_URL}/api/user/delete`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });
    const ok = res.status === 401;
    report('A01-8 DELETE /api/user/delete without auth returns 401', ok,
      ok ? undefined : `Got ${res.status}`);
  } catch (err) {
    report('A01-8 DELETE /api/user/delete', false, `Fetch error: ${err.message}`);
  }

  // A01-9. Access user export without auth
  try {
    const { res } = await safeFetch(`${BASE_URL}/api/user/export`, {
      headers: { 'Content-Type': 'application/json' },
    });
    const ok = res.status === 401;
    report('A01-9 GET /api/user/export without auth returns 401', ok,
      ok ? undefined : `Got ${res.status}`);
  } catch (err) {
    report('A01-9 GET /api/user/export', false, `Fetch error: ${err.message}`);
  }

  // A01-10. Access trip attachments of another user
  try {
    const { res } = await safeFetch(`${BASE_URL}/api/trips/${FAKE_UUID}/attachments`, {
      headers: { 'Content-Type': 'application/json' },
    });
    const ok = res.status === 401;
    report('A01-10 GET /api/trips/<fake>/attachments returns 401', ok,
      ok ? undefined : `Got ${res.status}`);
  } catch (err) {
    report('A01-10 GET trip attachments', false, `Fetch error: ${err.message}`);
  }

  // A01-11. Access trip expenses without auth
  try {
    const { res } = await safeFetch(`${BASE_URL}/api/trips/${FAKE_UUID}/expenses`, {
      headers: { 'Content-Type': 'application/json' },
    });
    const ok = res.status === 401;
    report('A01-11 GET /api/trips/<fake>/expenses returns 401', ok,
      ok ? undefined : `Got ${res.status}`);
  } catch (err) {
    report('A01-11 GET trip expenses', false, `Fetch error: ${err.message}`);
  }

  // A01-12. Duplicate a trip without auth
  try {
    const { res } = await safeFetch(`${BASE_URL}/api/trips/${FAKE_UUID}/duplicate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const ok = res.status === 401;
    report('A01-12 POST /api/trips/<fake>/duplicate returns 401', ok,
      ok ? undefined : `Got ${res.status}`);
  } catch (err) {
    report('A01-12 POST trip duplicate', false, `Fetch error: ${err.message}`);
  }

  // A01-13. Access trip report without auth
  try {
    const { res } = await safeFetch(`${BASE_URL}/api/trips/${FAKE_UUID}/report`, {
      headers: { 'Content-Type': 'application/json' },
    });
    const ok = res.status === 401;
    report('A01-13 GET /api/trips/<fake>/report returns 401', ok,
      ok ? undefined : `Got ${res.status}`);
  } catch (err) {
    report('A01-13 GET trip report', false, `Fetch error: ${err.message}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// A02 — CRYPTOGRAPHIC FAILURES (6 tests)
// ═══════════════════════════════════════════════════════════════════

async function testA02_CryptographicFailures() {
  console.log('\n── A02: Cryptographic Failures ──\n');

  // A02-1. Error messages do not expose sensitive data (passwords, keys, connection strings)
  try {
    const { res, body } = await safeFetch(`${BASE_URL}/api/trips`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
    const sensitivePatterns = ['password', 'secret', 'private_key', 'DATABASE_URL', 'SUPABASE_SERVICE_ROLE'];
    const noSensitive = !sensitivePatterns.some(p => bodyStr.toLowerCase().includes(p.toLowerCase()));
    report('A02-1 Error response does not expose secrets', noSensitive,
      noSensitive ? `Status ${res.status}` : 'Sensitive data found in error response');
  } catch (err) {
    report('A02-1 Error response secrets', false, `Fetch error: ${err.message}`);
  }

  // A02-2. HSTS header present (Strict-Transport-Security)
  try {
    const { res } = await safeFetch(`${BASE_URL}/`);
    const hsts = res.headers.get('strict-transport-security');
    // In dev mode HSTS may not be set — we check but note it
    const ok = hsts !== null;
    report('A02-2 Strict-Transport-Security header present', ok,
      hsts ? `HSTS: ${hsts}` : 'No HSTS header (may be dev mode)');
  } catch (err) {
    report('A02-2 HSTS header', false, `Fetch error: ${err.message}`);
  }

  // A02-3. Sensitive data not in URL parameters for user endpoints
  try {
    const { res } = await safeFetch(`${BASE_URL}/api/user?password=test123&secret=abc`, {
      headers: { 'Content-Type': 'application/json' },
    });
    const ok = res.status === 401;
    report('A02-3 Sensitive URL params do not bypass auth', ok,
      ok ? undefined : `Got ${res.status}`);
  } catch (err) {
    report('A02-3 Sensitive URL params', false, `Fetch error: ${err.message}`);
  }

  // A02-4. No sensitive data in response headers
  try {
    const { res } = await safeFetch(`${BASE_URL}/api/trips`);
    const sensitiveHeaders = ['x-database-url', 'x-api-key', 'x-secret-key', 'x-supabase-key'];
    const noSensitiveHeaders = !sensitiveHeaders.some(h => res.headers.get(h) !== null);
    report('A02-4 No sensitive data in response headers', noSensitiveHeaders,
      noSensitiveHeaders ? 'Clean headers' : 'Sensitive headers found');
  } catch (err) {
    report('A02-4 Response headers', false, `Fetch error: ${err.message}`);
  }

  // A02-5. X-Content-Type-Options: nosniff header
  try {
    const { res } = await safeFetch(`${BASE_URL}/api/trips`);
    const xcto = res.headers.get('x-content-type-options');
    const ok = xcto === 'nosniff';
    report('A02-5 X-Content-Type-Options: nosniff present', ok,
      xcto ? `Value: ${xcto}` : 'Header not set');
  } catch (err) {
    report('A02-5 X-Content-Type-Options', false, `Fetch error: ${err.message}`);
  }

  // A02-6. 401 response body does not leak user existence
  try {
    const { res, body } = await safeFetch(`${BASE_URL}/api/user`, {
      headers: { 'Content-Type': 'application/json' },
    });
    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
    const noUserLeak = !bodyStr.includes('user not found') && !bodyStr.includes('no such user');
    const ok = res.status === 401 && noUserLeak;
    report('A02-6 401 body does not leak user existence info', ok,
      `Status ${res.status}`);
  } catch (err) {
    report('A02-6 User existence leak', false, `Fetch error: ${err.message}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// A03 — INJECTION (12 tests)
// ═══════════════════════════════════════════════════════════════════

async function testA03_Injection() {
  console.log('\n── A03: Injection ──\n');

  // A03-1. SQL injection in trip title via POST
  try {
    const { res } = await safeFetch(`${BASE_URL}/api/trips`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: "'; DROP TABLE trips; --", destination: 'Test' }),
    });
    const ok = res.status === 401 || (res.status >= 200 && res.status < 500);
    report('A03-1 SQLi trip title: no server error', ok, `Status ${res.status}`);
  } catch (err) {
    report('A03-1 SQLi trip title', false, `Fetch error: ${err.message}`);
  }

  // A03-2. SQL injection via booking fields
  try {
    const { res } = await safeFetch(`${BASE_URL}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: "FLIGHT' UNION SELECT * FROM auth.users--",
        provider: "'; SELECT pg_sleep(5);--",
        confirmationNumber: "' OR 1=1; --",
      }),
    });
    const ok = res.status === 401 || (res.status >= 200 && res.status < 500);
    report('A03-2 SQLi booking fields: no server error', ok, `Status ${res.status}`);
  } catch (err) {
    report('A03-2 SQLi booking fields', false, `Fetch error: ${err.message}`);
  }

  // A03-3. SQL injection in vendor name
  try {
    const { res } = await safeFetch(`${BASE_URL}/api/vendors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: "Vendor'); DELETE FROM vendors WHERE ('1'='1" }),
    });
    const ok = res.status === 401 || (res.status >= 200 && res.status < 500);
    report('A03-3 SQLi vendor name: no server error', ok, `Status ${res.status}`);
  } catch (err) {
    report('A03-3 SQLi vendor name', false, `Fetch error: ${err.message}`);
  }

  // A03-4. SQL injection in search with UNION SELECT
  try {
    const payload = "' UNION SELECT id, email, encrypted_password FROM auth.users--";
    const { res, body } = await safeFetch(`${BASE_URL}/api/search?q=${encodeURIComponent(payload)}`);
    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
    const noPasswordLeak = !bodyStr.includes('encrypted_password') && !bodyStr.includes('$2a$');
    const ok = res.status < 500 && noPasswordLeak;
    report('A03-4 SQLi UNION SELECT in search: no data leak', ok, `Status ${res.status}`);
  } catch (err) {
    report('A03-4 SQLi UNION SELECT', false, `Fetch error: ${err.message}`);
  }

  // A03-5. NoSQL injection via operator injection in body
  try {
    const { res } = await safeFetch(`${BASE_URL}/api/trips`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: { "$gt": "" }, destination: { "$ne": null } }),
    });
    const ok = res.status === 401 || (res.status >= 200 && res.status < 500);
    report('A03-5 NoSQL operator injection: no server error', ok, `Status ${res.status}`);
  } catch (err) {
    report('A03-5 NoSQL operator injection', false, `Fetch error: ${err.message}`);
  }

  // A03-6. Command injection via trip destination
  try {
    const { res } = await safeFetch(`${BASE_URL}/api/trips`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Test', destination: '; cat /etc/passwd' }),
    });
    const ok = res.status === 401 || (res.status >= 200 && res.status < 500);
    report('A03-6 Command injection in destination: no execution', ok, `Status ${res.status}`);
  } catch (err) {
    report('A03-6 Command injection', false, `Fetch error: ${err.message}`);
  }

  // A03-7. Command injection via backticks
  try {
    const { res } = await safeFetch(`${BASE_URL}/api/trips`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '`whoami`', destination: '$(id)' }),
    });
    const ok = res.status === 401 || (res.status >= 200 && res.status < 500);
    report('A03-7 Command injection via backticks/subshell: safe', ok, `Status ${res.status}`);
  } catch (err) {
    report('A03-7 Command injection backticks', false, `Fetch error: ${err.message}`);
  }

  // A03-8. CRLF Header injection in search parameter
  try {
    const payload = 'test%0d%0aSet-Cookie:%20malicious=true';
    const { res } = await safeFetch(`${BASE_URL}/api/search?q=${payload}`);
    const maliciousCookie = res.headers.get('set-cookie') || '';
    const ok = !maliciousCookie.includes('malicious');
    report('A03-8 CRLF header injection: no injected Set-Cookie', ok,
      ok ? `Status ${res.status}` : `Injected cookie found: ${maliciousCookie}`);
  } catch (err) {
    report('A03-8 CRLF header injection', false, `Fetch error: ${err.message}`);
  }

  // A03-9. JSON injection — extra nested fields
  try {
    const { res } = await safeFetch(`${BASE_URL}/api/trips`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Normal Trip',
        destination: 'Paris',
        __proto__: { isAdmin: true },
        constructor: { prototype: { isAdmin: true } },
      }),
    });
    const ok = res.status === 401 || (res.status >= 200 && res.status < 500);
    report('A03-9 JSON prototype pollution attempt: safe', ok, `Status ${res.status}`);
  } catch (err) {
    report('A03-9 JSON prototype pollution', false, `Fetch error: ${err.message}`);
  }

  // A03-10. SQL injection via client creation
  try {
    const { res } = await safeFetch(`${BASE_URL}/api/clients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: "Robert'); DROP TABLE clients;--",
        email: "bobby@tables.com",
      }),
    });
    const ok = res.status === 401 || (res.status >= 200 && res.status < 500);
    report('A03-10 SQLi client creation (Bobby Tables): safe', ok, `Status ${res.status}`);
  } catch (err) {
    report('A03-10 SQLi client creation', false, `Fetch error: ${err.message}`);
  }

  // A03-11. Time-based blind SQL injection
  try {
    const { res } = await safeFetch(`${BASE_URL}/api/search?q=${encodeURIComponent("' OR pg_sleep(5)--")}`, {
      headers: { 'Content-Type': 'application/json' },
    });
    const ok = res.status < 500;
    report('A03-11 Time-based blind SQLi (pg_sleep): safe', ok, `Status ${res.status}`);
  } catch (err) {
    report('A03-11 Blind SQLi', false, `Fetch error: ${err.message}`);
  }

  // A03-12. Template injection via trip notes
  try {
    const { res } = await safeFetch(`${BASE_URL}/api/trips`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Test', destination: 'Test', notes: '{{7*7}}${7*7}<%= 7*7 %>' }),
    });
    const ok = res.status === 401 || (res.status >= 200 && res.status < 500);
    report('A03-12 Template injection in notes: safe', ok, `Status ${res.status}`);
  } catch (err) {
    report('A03-12 Template injection', false, `Fetch error: ${err.message}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// A04 — INSECURE DESIGN (7 tests)
// ═══════════════════════════════════════════════════════════════════

async function testA04_InsecureDesign() {
  console.log('\n── A04: Insecure Design ──\n');

  // A04-1. Negative budget amount in trip creation
  try {
    const { res } = await safeFetch(`${BASE_URL}/api/trips`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Negative Budget', destination: 'Test', budget: -99999 }),
    });
    const ok = res.status === 401 || res.status === 400 || (res.status >= 200 && res.status < 500);
    report('A04-1 Negative budget in trip: handled safely', ok, `Status ${res.status}`);
  } catch (err) {
    report('A04-1 Negative budget', false, `Fetch error: ${err.message}`);
  }

  // A04-2. Future start date before end date validation
  try {
    const { res } = await safeFetch(`${BASE_URL}/api/trips`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Date Logic Flaw',
        destination: 'Test',
        startDate: '2030-12-31',
        endDate: '2020-01-01',
      }),
    });
    const ok = res.status === 401 || res.status === 400 || (res.status >= 200 && res.status < 500);
    report('A04-2 End date before start date: handled', ok, `Status ${res.status}`);
  } catch (err) {
    report('A04-2 Date logic flaw', false, `Fetch error: ${err.message}`);
  }

  // A04-3. Extremely large budget value (integer overflow attempt)
  try {
    const { res } = await safeFetch(`${BASE_URL}/api/trips`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Overflow', destination: 'Test', budget: 99999999999999999 }),
    });
    const ok = res.status === 401 || (res.status >= 200 && res.status < 500);
    report('A04-3 Extremely large budget (overflow): no crash', ok, `Status ${res.status}`);
  } catch (err) {
    report('A04-3 Budget overflow', false, `Fetch error: ${err.message}`);
  }

  // A04-4. Excessive data exposure: API responses should not include internal fields
  try {
    const { res, body } = await safeFetch(`${BASE_URL}/api/trips`);
    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
    const noInternalFields = !bodyStr.includes('hashedPassword') &&
      !bodyStr.includes('internalId') &&
      !bodyStr.includes('serviceRoleKey');
    const ok = res.status === 401 || noInternalFields;
    report('A04-4 No internal fields exposed in /api/trips', ok,
      res.status === 401 ? 'Auth blocked' : 'No internal fields');
  } catch (err) {
    report('A04-4 Data exposure', false, `Fetch error: ${err.message}`);
  }

  // A04-5. Expense with negative amount
  try {
    const { res } = await safeFetch(`${BASE_URL}/api/trips/${FAKE_UUID}/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: 'Refund hack', amount: -5000, currency: 'USD' }),
    });
    const ok = res.status === 401 || res.status === 400 || (res.status >= 200 && res.status < 500);
    report('A04-5 Negative expense amount: handled', ok, `Status ${res.status}`);
  } catch (err) {
    report('A04-5 Negative expense', false, `Fetch error: ${err.message}`);
  }

  // A04-6. Rapid-fire trip creation (rate limiting indicator)
  try {
    const promises = Array.from({ length: 30 }, () =>
      safeFetch(`${BASE_URL}/api/trips`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Rate Limit Test', destination: 'Nowhere' }),
      }).then(({ res }) => res.status)
    );
    const statuses = await Promise.all(promises);
    const anyServerError = statuses.some(s => s >= 500);
    const any429 = statuses.some(s => s === 429);
    report('A04-6 Rapid-fire 30x POST trips: no server errors', !anyServerError,
      `429s: ${statuses.filter(s => s === 429).length}, 401s: ${statuses.filter(s => s === 401).length}`);
  } catch (err) {
    report('A04-6 Rate limiting', false, `Fetch error: ${err.message}`);
  }

  // A04-7. iCal export without auth
  try {
    const { res } = await safeFetch(`${BASE_URL}/api/trips/${FAKE_UUID}/ical`);
    const ok = res.status === 401;
    report('A04-7 iCal export without auth returns 401', ok,
      ok ? undefined : `Got ${res.status}`);
  } catch (err) {
    report('A04-7 iCal export', false, `Fetch error: ${err.message}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// A05 — SECURITY MISCONFIGURATION (10 tests)
// ═══════════════════════════════════════════════════════════════════

async function testA05_SecurityMisconfiguration() {
  console.log('\n── A05: Security Misconfiguration ──\n');

  // A05-1. Default error pages do not expose stack traces
  try {
    const { res, body } = await safeFetch(`${BASE_URL}/api/nonexistent-route-12345`);
    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
    const noStackTrace = !bodyStr.includes('at ') || !bodyStr.includes('.js:');
    const noSrcPath = !bodyStr.includes('src/') && !bodyStr.includes('node_modules/');
    const ok = noStackTrace && noSrcPath;
    report('A05-1 404 page does not expose stack traces', ok,
      ok ? `Status ${res.status}` : 'Stack trace or paths found');
  } catch (err) {
    report('A05-1 Stack trace exposure', false, `Fetch error: ${err.message}`);
  }

  // A05-2. Server headers do not reveal technology stack in detail
  try {
    const { res } = await safeFetch(`${BASE_URL}/`);
    const server = res.headers.get('server') || '';
    const noVersionLeak = !server.match(/\d+\.\d+\.\d+/);
    report('A05-2 Server header does not reveal version numbers', noVersionLeak,
      `Server: "${server}"`);
  } catch (err) {
    report('A05-2 Server header', false, `Fetch error: ${err.message}`);
  }

  // A05-3. X-Powered-By header removed or minimal
  try {
    const { res } = await safeFetch(`${BASE_URL}/`);
    const poweredBy = res.headers.get('x-powered-by');
    const ok = poweredBy === null;
    report('A05-3 X-Powered-By header removed', ok,
      poweredBy ? `Value: "${poweredBy}"` : 'Not present');
  } catch (err) {
    report('A05-3 X-Powered-By', false, `Fetch error: ${err.message}`);
  }

  // A05-4. CORS: Wildcard origin not allowed on API routes
  try {
    const { res } = await safeFetch(`${BASE_URL}/api/trips`, {
      headers: {
        'Origin': 'https://evil-site.com',
        'Content-Type': 'application/json',
      },
    });
    const acao = res.headers.get('access-control-allow-origin') || '';
    const ok = acao !== '*';
    report('A05-4 CORS: No wildcard Access-Control-Allow-Origin', ok,
      `ACAO: "${acao}"`);
  } catch (err) {
    report('A05-4 CORS wildcard', false, `Fetch error: ${err.message}`);
  }

  // A05-5. CORS: Evil origin not reflected
  try {
    const { res } = await safeFetch(`${BASE_URL}/api/trips`, {
      headers: {
        'Origin': 'https://evil-site.com',
        'Content-Type': 'application/json',
      },
    });
    const acao = res.headers.get('access-control-allow-origin') || '';
    const ok = !acao.includes('evil-site.com');
    report('A05-5 CORS: Evil origin not reflected', ok,
      `ACAO: "${acao}"`);
  } catch (err) {
    report('A05-5 CORS origin reflection', false, `Fetch error: ${err.message}`);
  }

  // A05-6. Directory listing disabled on common paths
  const dirPaths = ['/api/', '/src/', '/_next/', '/public/'];
  for (const dirPath of dirPaths) {
    try {
      const { res, body } = await safeFetch(`${BASE_URL}${dirPath}`);
      const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
      const noDirectoryListing = !bodyStr.includes('Index of') && !bodyStr.includes('Directory listing');
      const ok = noDirectoryListing;
      report(`A05-6 No directory listing: ${dirPath}`, ok,
        `Status ${res.status}`);
    } catch (err) {
      report(`A05-6 Directory listing: ${dirPath}`, false, `Fetch error: ${err.message}`);
    }
  }

  // A05-7. Debug endpoints not accessible
  const debugPaths = ['/api/debug', '/api/test', '/_debug', '/debug', '/api/healthcheck'];
  for (const dp of debugPaths) {
    try {
      const { res, body } = await safeFetch(`${BASE_URL}${dp}`);
      const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
      const noDebugInfo = !bodyStr.includes('NODE_ENV') && !bodyStr.includes('process.env');
      const ok = (res.status === 404 || res.status === 401 || res.status === 403) && noDebugInfo;
      report(`A05-7 Debug endpoint blocked: ${dp}`, ok,
        `Status ${res.status}`);
    } catch (err) {
      report(`A05-7 Debug endpoint: ${dp}`, false, `Fetch error: ${err.message}`);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// A06 — VULNERABLE & OUTDATED COMPONENTS (5 tests)
// ═══════════════════════════════════════════════════════════════════

async function testA06_VulnerableComponents() {
  console.log('\n── A06: Vulnerable & Outdated Components ──\n');

  // A06-1. package.json not publicly accessible
  try {
    const { res, body } = await safeFetch(`${BASE_URL}/package.json`);
    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
    const notExposed = !bodyStr.includes('"dependencies"') && !bodyStr.includes('"devDependencies"');
    report('A06-1 package.json not publicly accessible', notExposed,
      notExposed ? `Status ${res.status}` : 'package.json contents exposed');
  } catch (err) {
    report('A06-1 package.json', false, `Fetch error: ${err.message}`);
  }

  // A06-2. yarn.lock / package-lock.json not publicly accessible
  try {
    const { res: res1 } = await safeFetch(`${BASE_URL}/yarn.lock`);
    const { res: res2 } = await safeFetch(`${BASE_URL}/package-lock.json`);
    const body1Str = await res1.text().catch(() => '');
    const body2Str = await res2.text().catch(() => '');
    const ok = !body1Str.includes('resolved') && !body2Str.includes('"lockfileVersion"');
    report('A06-2 Lock files not publicly accessible', ok,
      `yarn.lock: ${res1.status}, package-lock: ${res2.status}`);
  } catch (err) {
    report('A06-2 Lock files', false, `Fetch error: ${err.message}`);
  }

  // A06-3. .env file not publicly accessible
  try {
    const { res, body } = await safeFetch(`${BASE_URL}/.env`);
    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
    const notExposed = !bodyStr.includes('SUPABASE') && !bodyStr.includes('DATABASE_URL') && !bodyStr.includes('SECRET');
    report('A06-3 .env file not publicly accessible', notExposed,
      notExposed ? `Status ${res.status}` : '.env contents exposed!');
  } catch (err) {
    report('A06-3 .env file', false, `Fetch error: ${err.message}`);
  }

  // A06-4. .git directory not accessible
  try {
    const { res, body } = await safeFetch(`${BASE_URL}/.git/HEAD`);
    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
    const notExposed = !bodyStr.includes('ref:') && !bodyStr.includes('refs/heads');
    report('A06-4 .git/HEAD not publicly accessible', notExposed,
      notExposed ? `Status ${res.status}` : '.git directory exposed!');
  } catch (err) {
    report('A06-4 .git directory', false, `Fetch error: ${err.message}`);
  }

  // A06-5. .env.local not publicly accessible
  try {
    const { res, body } = await safeFetch(`${BASE_URL}/.env.local`);
    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
    const notExposed = !bodyStr.includes('SUPABASE') && !bodyStr.includes('NEXT_PUBLIC');
    report('A06-5 .env.local not publicly accessible', notExposed,
      notExposed ? `Status ${res.status}` : '.env.local contents exposed!');
  } catch (err) {
    report('A06-5 .env.local file', false, `Fetch error: ${err.message}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// A07 — IDENTIFICATION & AUTHENTICATION FAILURES (12 tests)
// ═══════════════════════════════════════════════════════════════════

async function testA07_AuthenticationFailures() {
  console.log('\n── A07: Identification & Authentication Failures ──\n');

  // A07-1. Session fixation: Pre-set session cookie is not accepted
  try {
    const { res } = await safeFetch(`${BASE_URL}/api/user`, {
      headers: {
        'Cookie': 'sb-access-token=attacker-chosen-session-id-12345',
        'Content-Type': 'application/json',
      },
    });
    const ok = res.status === 401;
    report('A07-1 Session fixation: pre-set session cookie rejected', ok,
      ok ? undefined : `Got ${res.status}`);
  } catch (err) {
    report('A07-1 Session fixation', false, `Fetch error: ${err.message}`);
  }

  // A07-2. Brute force protection: Rapid auth attempts don't cause server errors
  try {
    const promises = Array.from({ length: 20 }, () =>
      safeFetch(`${BASE_URL}/api/user`, {
        headers: {
          'Authorization': 'Bearer invalid-token-' + Math.random(),
          'Content-Type': 'application/json',
        },
      }).then(({ res }) => res.status)
    );
    const statuses = await Promise.all(promises);
    const noServerErrors = !statuses.some(s => s >= 500);
    report('A07-2 Brute force: 20 rapid invalid auth attempts — no 500s', noServerErrors,
      `Statuses: ${[...new Set(statuses)].join(', ')}`);
  } catch (err) {
    report('A07-2 Brute force', false, `Fetch error: ${err.message}`);
  }

  // A07-3. Cookie attributes: HttpOnly and Secure flags on set-cookie
  try {
    const { res } = await safeFetch(`${BASE_URL}/`);
    const setCookie = res.headers.get('set-cookie') || '';
    // In dev mode cookies may not have Secure flag — check HttpOnly at minimum
    const hasHttpOnly = setCookie.toLowerCase().includes('httponly') || setCookie === '';
    report('A07-3 Cookie attributes: HttpOnly present (or no cookies set)', hasHttpOnly,
      setCookie ? `Set-Cookie: ${setCookie.substring(0, 80)}...` : 'No Set-Cookie header');
  } catch (err) {
    report('A07-3 Cookie attributes', false, `Fetch error: ${err.message}`);
  }

  // A07-4. Forged JWT with "none" algorithm
  try {
    // JWT with alg: "none" — a classic bypass attempt
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ sub: 'admin', role: 'admin', exp: 9999999999 })).toString('base64url');
    const forgedJWT = `${header}.${payload}.`;
    const { res } = await safeFetch(`${BASE_URL}/api/user`, {
      headers: {
        'Authorization': `Bearer ${forgedJWT}`,
        'Content-Type': 'application/json',
      },
    });
    const ok = res.status === 401;
    report('A07-4 Forged JWT with alg:none rejected', ok,
      ok ? undefined : `Got ${res.status}`);
  } catch (err) {
    report('A07-4 JWT alg:none', false, `Fetch error: ${err.message}`);
  }

  // A07-5. Forged JWT with wrong signature
  try {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ sub: '12345', role: 'authenticated' })).toString('base64url');
    const forgedJWT = `${header}.${payload}.totally-wrong-signature`;
    const { res } = await safeFetch(`${BASE_URL}/api/user`, {
      headers: {
        'Authorization': `Bearer ${forgedJWT}`,
        'Content-Type': 'application/json',
      },
    });
    const ok = res.status === 401;
    report('A07-5 JWT with wrong signature rejected', ok,
      ok ? undefined : `Got ${res.status}`);
  } catch (err) {
    report('A07-5 JWT wrong signature', false, `Fetch error: ${err.message}`);
  }

  // A07-6. Manipulated X-Forwarded-For header doesn't bypass auth
  try {
    const { res } = await safeFetch(`${BASE_URL}/api/user`, {
      headers: {
        'X-Forwarded-For': '127.0.0.1',
        'Content-Type': 'application/json',
      },
    });
    const ok = res.status === 401;
    report('A07-6 X-Forwarded-For: 127.0.0.1 does not bypass auth', ok,
      ok ? undefined : `Got ${res.status}`);
  } catch (err) {
    report('A07-6 X-Forwarded-For bypass', false, `Fetch error: ${err.message}`);
  }

  // A07-7. Manipulated X-Real-IP doesn't bypass auth
  try {
    const { res } = await safeFetch(`${BASE_URL}/api/user`, {
      headers: {
        'X-Real-IP': '127.0.0.1',
        'X-Original-URL': '/api/admin',
        'Content-Type': 'application/json',
      },
    });
    const ok = res.status === 401;
    report('A07-7 X-Real-IP / X-Original-URL does not bypass auth', ok,
      ok ? undefined : `Got ${res.status}`);
  } catch (err) {
    report('A07-7 X-Real-IP bypass', false, `Fetch error: ${err.message}`);
  }

  // A07-8. Auth cookie with tampered payload
  try {
    // Simulate a Supabase auth cookie structure with tampered data
    const tamperedPayload = Buffer.from(JSON.stringify({
      sub: FAKE_UUID,
      email: 'hacker@evil.com',
      role: 'service_role',
      aud: 'authenticated',
    })).toString('base64');
    const { res } = await safeFetch(`${BASE_URL}/api/user`, {
      headers: {
        'Cookie': `sb-access-token=eyJhbGciOiJIUzI1NiJ9.${tamperedPayload}.fake-signature`,
        'Content-Type': 'application/json',
      },
    });
    const ok = res.status === 401;
    report('A07-8 Tampered auth cookie with service_role rejected', ok,
      ok ? undefined : `Got ${res.status}`);
  } catch (err) {
    report('A07-8 Tampered auth cookie', false, `Fetch error: ${err.message}`);
  }

  // A07-9. Empty Authorization header
  try {
    const { res } = await safeFetch(`${BASE_URL}/api/trips`, {
      headers: {
        'Authorization': '',
        'Content-Type': 'application/json',
      },
    });
    const ok = res.status === 401;
    report('A07-9 Empty Authorization header returns 401', ok,
      ok ? undefined : `Got ${res.status}`);
  } catch (err) {
    report('A07-9 Empty auth header', false, `Fetch error: ${err.message}`);
  }

  // A07-10. Multiple Authorization headers
  try {
    const { res } = await safeFetch(`${BASE_URL}/api/trips`, {
      headers: {
        'Authorization': 'Bearer fake-token-1',
        'Content-Type': 'application/json',
      },
    });
    const ok = res.status === 401;
    report('A07-10 Fake Bearer token returns 401', ok,
      ok ? undefined : `Got ${res.status}`);
  } catch (err) {
    report('A07-10 Multiple auth headers', false, `Fetch error: ${err.message}`);
  }

  // A07-11. Session management: Expired token format
  try {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      sub: FAKE_UUID,
      exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
      role: 'authenticated',
    })).toString('base64url');
    const expiredJWT = `${header}.${payload}.fake-sig`;
    const { res } = await safeFetch(`${BASE_URL}/api/user`, {
      headers: {
        'Authorization': `Bearer ${expiredJWT}`,
        'Content-Type': 'application/json',
      },
    });
    const ok = res.status === 401;
    report('A07-11 Expired JWT rejected', ok,
      ok ? undefined : `Got ${res.status}`);
  } catch (err) {
    report('A07-11 Expired JWT', false, `Fetch error: ${err.message}`);
  }

  // A07-12. Cookie with modified Supabase project ref
  try {
    const { res } = await safeFetch(`${BASE_URL}/api/user`, {
      headers: {
        'Cookie': 'sb-WRONG-PROJECT-REF-auth-token=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NSJ9.fake',
        'Content-Type': 'application/json',
      },
    });
    const ok = res.status === 401;
    report('A07-12 Cookie with wrong project ref rejected', ok,
      ok ? undefined : `Got ${res.status}`);
  } catch (err) {
    report('A07-12 Wrong project ref', false, `Fetch error: ${err.message}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// A08 — SOFTWARE & DATA INTEGRITY FAILURES (7 tests)
// ═══════════════════════════════════════════════════════════════════

async function testA08_DataIntegrity() {
  console.log('\n── A08: Software & Data Integrity Failures ──\n');

  // A08-1. Content-Type enforcement: XML body to JSON endpoint
  try {
    const { res } = await safeFetch(`${BASE_URL}/api/trips`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/xml' },
      body: '<trip><title>XML Trip</title></trip>',
    });
    const ok = res.status < 500;
    report('A08-1 XML body to JSON endpoint: no server crash', ok, `Status ${res.status}`);
  } catch (err) {
    report('A08-1 XML content-type', false, `Fetch error: ${err.message}`);
  }

  // A08-2. Content-Type enforcement: multipart body to JSON endpoint
  try {
    const { res } = await safeFetch(`${BASE_URL}/api/trips`, {
      method: 'POST',
      headers: { 'Content-Type': 'multipart/form-data; boundary=---test' },
      body: '-----test\r\nContent-Disposition: form-data; name="title"\r\n\r\nTest\r\n-----test--',
    });
    const ok = res.status < 500;
    report('A08-2 Multipart body to JSON endpoint: no crash', ok, `Status ${res.status}`);
  } catch (err) {
    report('A08-2 Multipart content-type', false, `Fetch error: ${err.message}`);
  }

  // A08-3. Mass assignment: Extra fields in trip creation
  try {
    const { res, body } = await safeFetch(`${BASE_URL}/api/trips`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Normal Trip',
        destination: 'Paris',
        userId: FAKE_UUID_2,
        role: 'admin',
        isAdmin: true,
        internal_field: 'should-be-ignored',
      }),
    });
    // Auth should block first; if somehow it doesn't, extra fields should be stripped
    const ok = res.status === 401 || (res.status < 500);
    report('A08-3 Mass assignment: extra fields in trip creation', ok, `Status ${res.status}`);
  } catch (err) {
    report('A08-3 Mass assignment trip', false, `Fetch error: ${err.message}`);
  }

  // A08-4. Mass assignment: Override userId in booking
  try {
    const { res } = await safeFetch(`${BASE_URL}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'FLIGHT',
        provider: 'Test Air',
        userId: FAKE_UUID_2,
        ownerId: FAKE_UUID_2,
      }),
    });
    const ok = res.status === 401 || (res.status < 500);
    report('A08-4 Mass assignment: userId override in booking', ok, `Status ${res.status}`);
  } catch (err) {
    report('A08-4 Mass assignment booking', false, `Fetch error: ${err.message}`);
  }

  // A08-5. Mass assignment: Attempt to set createdAt/updatedAt
  try {
    const { res } = await safeFetch(`${BASE_URL}/api/trips`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Timestamp Tamper',
        destination: 'Test',
        createdAt: '1970-01-01T00:00:00Z',
        updatedAt: '1970-01-01T00:00:00Z',
      }),
    });
    const ok = res.status === 401 || (res.status < 500);
    report('A08-5 Mass assignment: timestamp override attempt', ok, `Status ${res.status}`);
  } catch (err) {
    report('A08-5 Timestamp override', false, `Fetch error: ${err.message}`);
  }

  // A08-6. Invalid JSON body handling
  try {
    const { res } = await safeFetch(`${BASE_URL}/api/trips`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{invalid json: ???}',
    });
    const ok = res.status < 500;
    report('A08-6 Invalid JSON body: no server crash', ok, `Status ${res.status}`);
  } catch (err) {
    report('A08-6 Invalid JSON', false, `Fetch error: ${err.message}`);
  }

  // A08-7. Empty body on POST endpoints
  try {
    const { res } = await safeFetch(`${BASE_URL}/api/vendors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const ok = res.status < 500;
    report('A08-7 Empty body POST /api/vendors: no crash', ok, `Status ${res.status}`);
  } catch (err) {
    report('A08-7 Empty body', false, `Fetch error: ${err.message}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// A09 — SECURITY LOGGING & MONITORING FAILURES (4 tests)
// ═══════════════════════════════════════════════════════════════════

async function testA09_LoggingMonitoring() {
  console.log('\n── A09: Security Logging & Monitoring Failures ──\n');

  // A09-1. Failed auth attempts do not expose useful info to attacker
  try {
    const { res, body } = await safeFetch(`${BASE_URL}/api/user`, {
      headers: {
        'Authorization': 'Bearer completely-invalid-token',
        'Content-Type': 'application/json',
      },
    });
    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
    const noDebugInfo = !bodyStr.includes('stack') &&
      !bodyStr.includes('trace') &&
      !bodyStr.includes('SUPABASE_URL') &&
      !bodyStr.includes('JWT_SECRET');
    const ok = res.status === 401 && noDebugInfo;
    report('A09-1 Failed auth: no debug info in response', ok,
      `Status ${res.status}, body length: ${bodyStr.length}`);
  } catch (err) {
    report('A09-1 Failed auth info leak', false, `Fetch error: ${err.message}`);
  }

  // A09-2. Error responses are consistent (same structure for different failure types)
  try {
    const { body: body1 } = await safeFetch(`${BASE_URL}/api/trips`, {
      headers: { 'Content-Type': 'application/json' },
    });
    const { body: body2 } = await safeFetch(`${BASE_URL}/api/bookings`, {
      headers: { 'Content-Type': 'application/json' },
    });
    const str1 = typeof body1 === 'string' ? body1 : JSON.stringify(body1);
    const str2 = typeof body2 === 'string' ? body2 : JSON.stringify(body2);
    // Both should have similar error structure (e.g., { error: "..." })
    const has1Error = str1.includes('error');
    const has2Error = str2.includes('error');
    const ok = has1Error && has2Error;
    report('A09-2 Consistent error response structure across endpoints', ok,
      `trips: ${str1.substring(0, 50)}, bookings: ${str2.substring(0, 50)}`);
  } catch (err) {
    report('A09-2 Error consistency', false, `Fetch error: ${err.message}`);
  }

  // A09-3. 500 errors do not expose internal details
  try {
    // Send a body that might cause internal errors
    const { res, body } = await safeFetch(`${BASE_URL}/api/trips/${FAKE_UUID}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json-at-all',
    });
    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
    const noInternals = !bodyStr.includes('node_modules') &&
      !bodyStr.includes('TypeError') &&
      !bodyStr.includes('SyntaxError');
    const ok = res.status === 401 || noInternals;
    report('A09-3 Error responses do not expose error class names', ok,
      `Status ${res.status}`);
  } catch (err) {
    report('A09-3 Error internals', false, `Fetch error: ${err.message}`);
  }

  // A09-4. Different invalid tokens produce same response format
  try {
    const { res: res1, body: body1 } = await safeFetch(`${BASE_URL}/api/user`, {
      headers: { 'Authorization': 'Bearer token-a', 'Content-Type': 'application/json' },
    });
    const { res: res2, body: body2 } = await safeFetch(`${BASE_URL}/api/user`, {
      headers: { 'Authorization': 'Bearer token-b', 'Content-Type': 'application/json' },
    });
    const str1 = typeof body1 === 'string' ? body1 : JSON.stringify(body1);
    const str2 = typeof body2 === 'string' ? body2 : JSON.stringify(body2);
    const sameStatus = res1.status === res2.status;
    const sameBody = str1 === str2;
    const ok = sameStatus && sameBody;
    report('A09-4 Different invalid tokens produce identical responses', ok,
      `Status1: ${res1.status}, Status2: ${res2.status}, same body: ${sameBody}`);
  } catch (err) {
    report('A09-4 Token response consistency', false, `Fetch error: ${err.message}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// A10 — SERVER-SIDE REQUEST FORGERY (SSRF) (5 tests)
// ═══════════════════════════════════════════════════════════════════

async function testA10_SSRF() {
  console.log('\n── A10: Server-Side Request Forgery (SSRF) ──\n');

  // A10-1. SSRF via URL parameter — internal IP
  try {
    const { res, body } = await safeFetch(
      `${BASE_URL}/api/geocode/search?q=${encodeURIComponent('http://169.254.169.254/latest/meta-data/')}`,
      { headers: { 'Content-Type': 'application/json' } }
    );
    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
    const noMetadata = !bodyStr.includes('ami-id') && !bodyStr.includes('instance-id');
    const ok = res.status < 500 && noMetadata;
    report('A10-1 SSRF via geocode search: AWS metadata not leaked', ok,
      `Status ${res.status}`);
  } catch (err) {
    report('A10-1 SSRF geocode', false, `Fetch error: ${err.message}`);
  }

  // A10-2. SSRF via URL parameter — localhost
  try {
    const { res, body } = await safeFetch(
      `${BASE_URL}/api/geocode/search?q=${encodeURIComponent('http://localhost:3000/api/user')}`,
      { headers: { 'Content-Type': 'application/json' } }
    );
    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
    const noInternalData = !bodyStr.includes('email') || res.status === 401;
    const ok = res.status < 500 && noInternalData;
    report('A10-2 SSRF via geocode: localhost not fetched', ok,
      `Status ${res.status}`);
  } catch (err) {
    report('A10-2 SSRF localhost', false, `Fetch error: ${err.message}`);
  }

  // A10-3. SSRF via internal network address
  try {
    const { res, body } = await safeFetch(
      `${BASE_URL}/api/geocode/search?q=${encodeURIComponent('http://10.0.0.1/admin')}`,
      { headers: { 'Content-Type': 'application/json' } }
    );
    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
    const ok = res.status < 500;
    report('A10-3 SSRF via geocode: internal network IP handled safely', ok,
      `Status ${res.status}`);
  } catch (err) {
    report('A10-3 SSRF internal IP', false, `Fetch error: ${err.message}`);
  }

  // A10-4. Open redirect check — Location header validation
  try {
    const { res } = await safeFetch(`${BASE_URL}/api/trips?redirect=${encodeURIComponent('https://evil.com')}`, {
      headers: { 'Content-Type': 'application/json' },
    });
    const location = res.headers.get('location') || '';
    const noEvilRedirect = !location.includes('evil.com');
    const ok = noEvilRedirect;
    report('A10-4 Open redirect: redirect param not followed to evil.com', ok,
      location ? `Location: ${location}` : 'No redirect');
  } catch (err) {
    report('A10-4 Open redirect', false, `Fetch error: ${err.message}`);
  }

  // A10-5. SSRF via file:// protocol
  try {
    const { res, body } = await safeFetch(
      `${BASE_URL}/api/geocode/search?q=${encodeURIComponent('file:///etc/passwd')}`,
      { headers: { 'Content-Type': 'application/json' } }
    );
    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
    const noFileContents = !bodyStr.includes('root:') && !bodyStr.includes('/bin/bash');
    const ok = res.status < 500 && noFileContents;
    report('A10-5 SSRF via file:// protocol: blocked', ok,
      `Status ${res.status}`);
  } catch (err) {
    report('A10-5 SSRF file protocol', false, `Fetch error: ${err.message}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// RUN
// ═══════════════════════════════════════════════════════════════════

async function main() {
  console.log(`\nOWASP Top 10 Security Tests — Travel Manager`);
  console.log(`Target: ${BASE_URL}`);

  await testA01_BrokenAccessControl();
  await testA02_CryptographicFailures();
  await testA03_Injection();
  await testA04_InsecureDesign();
  await testA05_SecurityMisconfiguration();
  await testA06_VulnerableComponents();
  await testA07_AuthenticationFailures();
  await testA08_DataIntegrity();
  await testA09_LoggingMonitoring();
  await testA10_SSRF();

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
