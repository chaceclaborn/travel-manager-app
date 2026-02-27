/**
 * File Upload Security Tests — Travel Manager
 *
 * Tests the attachment upload endpoint for basic security properties.
 * Run: node tests/travelmanager/file-upload-security.test.mjs
 *
 * Requires: dev server running at http://localhost:3000
 */

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';
const UPLOAD_ENDPOINT = `${BASE_URL}/api/travelmanager/trips/fake-trip-id/attachments`;

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

// ─── Automated Tests ───

async function testUploadRequiresAuth() {
  try {
    const form = new FormData();
    form.append('file', new Blob(['test content'], { type: 'application/pdf' }), 'test.pdf');

    const res = await fetch(UPLOAD_ENDPOINT, { method: 'POST', body: form });
    report(
      'Upload requires authentication',
      res.status === 401,
      `Expected 401, got ${res.status}`
    );
  } catch (err) {
    report('Upload requires authentication', false, `Request failed: ${err.message}`);
  }
}

async function testUploadGetRequiresAuth() {
  try {
    const res = await fetch(UPLOAD_ENDPOINT);
    report(
      'GET attachments requires authentication',
      res.status === 401,
      `Expected 401, got ${res.status}`
    );
  } catch (err) {
    report('GET attachments requires authentication', false, `Request failed: ${err.message}`);
  }
}

// ─── Documented Test Cases (require auth to automate) ───

function documentManualTests() {
  console.log('\n--- Documented Test Cases (require auth to run) ---\n');

  const manualTests = [
    {
      name: 'Path traversal: ../../../etc/passwd',
      description: 'Upload a file named "../../../etc/passwd". The server sanitizes filenames by replacing non-alphanumeric chars (except . - _) with underscores.',
      expected: 'Filename is sanitized to "______etc_passwd". File is stored in user-scoped path: {userId}/{tripId}/{timestamp}-______etc_passwd',
      codeRef: 'src/app/api/travelmanager/trips/[id]/attachments/route.ts:56 — safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, \'_\')',
    },
    {
      name: 'Path traversal: ..\\..\\windows\\system32',
      description: 'Upload a file with backslash path traversal in the name.',
      expected: 'Backslashes are sanitized to underscores by the same regex.',
    },
    {
      name: 'Null byte injection: file%00.pdf',
      description: 'Upload a file with null bytes in the filename.',
      expected: 'Null bytes are replaced with underscores. Supabase storage also rejects null bytes.',
    },
    {
      name: 'MIME type spoofing: .exe disguised as application/pdf',
      description: 'Upload a .exe file with Content-Type set to application/pdf.',
      expected: 'Server checks the MIME type from the Content-Type header. While the header says PDF, the actual file extension would pass sanitization. The ALLOWED_MIME_TYPES whitelist prevents arbitrary types, but does not verify magic bytes.',
      risk: 'MEDIUM — Server trusts Content-Type header. A malicious user could upload an executable with a spoofed MIME type. However, files are stored in Supabase private bucket and served through signed URLs, limiting direct execution risk.',
    },
    {
      name: 'MIME type spoofing: text/html as allowed type',
      description: 'Upload an HTML file to test if text/html is accepted.',
      expected: 'REJECTED — text/html is not in the ALLOWED_MIME_TYPES whitelist. Only PDF, Word, JPEG, PNG, GIF, WebP are allowed.',
    },
    {
      name: 'Oversized file: 11MB upload',
      description: 'Upload a file larger than 10MB.',
      expected: 'Returns 400 with "File size must be 10MB or less". Checked at route.ts:45-47.',
    },
    {
      name: 'Empty file upload',
      description: 'Submit the form without a file attached.',
      expected: 'Returns 400 with "File is required".',
    },
    {
      name: 'Cross-user attachment access',
      description: 'User B tries to GET attachments for user A\'s trip.',
      expected: 'Returns error — verifyTripOwnership(tripId, userB.id) fails with "Trip not found".',
    },
    {
      name: 'Storage path isolation',
      description: 'Verify uploaded files are stored under {userId}/{tripId}/ prefix.',
      expected: 'Each user\'s files are namespaced under their userId in Supabase Storage, preventing cross-user access at the storage level.',
      codeRef: 'src/app/api/travelmanager/trips/[id]/attachments/route.ts:57 — storagePath = `${user.id}/${tripId}/${Date.now()}-${safeName}`',
    },
  ];

  manualTests.forEach((test, i) => {
    console.log(`  ${i + 1}. ${test.name}`);
    console.log(`     ${test.description}`);
    console.log(`     Expected: ${test.expected}`);
    if (test.risk) console.log(`     Risk: ${test.risk}`);
    if (test.codeRef) console.log(`     Code: ${test.codeRef}`);
    console.log();
  });
}

// ─── Run ───

async function main() {
  console.log(`\nFile Upload Security Tests`);
  console.log(`Target: ${UPLOAD_ENDPOINT}\n`);
  console.log('--- Automated Tests ---\n');

  await testUploadRequiresAuth();
  await testUploadGetRequiresAuth();

  documentManualTests();

  console.log('--- Summary ---');
  console.log(`  Automated: ${passed} passed, ${failed} failed out of ${passed + failed}`);
  console.log(`  Documented: 9 manual test cases (require auth to automate)\n`);

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
