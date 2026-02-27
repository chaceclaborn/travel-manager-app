/**
 * UI Smoke Tests — Travel Manager Public Pages
 *
 * Fetches public pages via HTTP and checks rendered HTML content.
 * Run: node tests/travelmanager/ui-smoke.test.mjs
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

function assertNotContains(html, text, testName) {
  const found = html.includes(text);
  report(testName, !found, found ? `"${text}" was found but should not be` : undefined);
  return !found;
}

// ─── Tour Page Tests ───

async function testTourPage() {
  console.log('\n  Tour Page (/travelmanager/tour)\n');

  let res;
  try {
    res = await fetch(`${BASE_URL}/travelmanager/tour`);
  } catch (err) {
    report('Tour page is reachable', false, `Fetch failed: ${err.message}`);
    return;
  }

  report('Tour page returns 200', res.status === 200, `Got ${res.status}`);

  const html = await res.text();

  assertContains(html, 'Travel Manager', 'Contains "Travel Manager" heading');
  assertContains(html, 'Sign in with Google', 'Contains "Sign in with Google" button text');

  // Feature names
  const features = [
    'Trip Planning',
    'Vendor Management',
    'Client Tracking',
    'File Attachments',
    'Calendar View',
    'Global Search',
  ];
  for (const feature of features) {
    assertContains(html, feature, `Contains feature: "${feature}"`);
  }

  assertContains(html, 'Your data is secure', 'Contains "Your data is secure" section');
  assertContains(html, '/travelmanager/privacy', 'Contains link to Privacy Policy');
  assertNotContains(html, 'Free for personal and business use', 'Does NOT contain "Free for personal and business use"');
}

// ─── Privacy Page Tests ───

async function testPrivacyPage() {
  console.log('\n  Privacy Page (/travelmanager/privacy)\n');

  let res;
  try {
    res = await fetch(`${BASE_URL}/travelmanager/privacy`);
  } catch (err) {
    report('Privacy page is reachable', false, `Fetch failed: ${err.message}`);
    return;
  }

  report('Privacy page returns 200', res.status === 200, `Got ${res.status}`);

  const html = await res.text();

  assertContains(html, 'Privacy Policy', 'Contains "Privacy Policy" heading');

  // Section headings
  const sections = [
    'Data We Collect',
    'How We Store Your Data',
    'Data Isolation',
    'Data Retention',
    'Your Rights',
    'Third-Party Sharing',
    'Contact',
  ];
  for (const section of sections) {
    assertContains(html, section, `Contains section: "${section}"`);
  }

  // Key privacy statements
  assertContains(html, 'do not sell', 'Contains "do not sell" statement');
  assertContains(html, 'do not share', 'Contains "do not share" statement');
  assertContains(html, 'ncrypted', 'Contains "encrypted" statement');
  assertContains(html, 'elete your account', 'Contains "delete your account" statement');

  assertContains(html, 'Back to Tour', 'Contains "Back to Tour" link');
}

// ─── Run ───

async function main() {
  console.log(`\nUI Smoke Tests — Travel Manager`);
  console.log(`Target: ${BASE_URL}`);

  await testTourPage();
  await testPrivacyPage();

  console.log('\n--- Summary ---');
  console.log(`  ${passed} passed, ${failed} failed out of ${passed + failed} tests\n`);

  if (failed > 0) {
    console.log('RESULT: SOME TESTS FAILED\n');
    process.exit(1);
  } else {
    console.log('RESULT: ALL TESTS PASSED\n');
  }
}

main().catch((err) => {
  console.error('Test runner error:', err);
  process.exit(1);
});
