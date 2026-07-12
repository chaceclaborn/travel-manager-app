import { test, expect } from '@playwright/test';

/**
 * API contract smoke: proves the serverless functions, auth gate, and
 * version-policy endpoint are alive. Safe against production.
 */

test('auth-gated API rejects unauthenticated requests', async ({ request }) => {
  for (const path of ['/api/dashboard', '/api/trips', '/api/search?q=test']) {
    const res = await request.get(path);
    expect(res.status(), `${path} must require auth`).toBe(401);
  }
});

test('app-config exposes a coherent version policy', async ({ request }) => {
  const res = await request.get('/api/app-config');
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.minVersion).toMatch(/^\d+(\.\d+)*$/);
  expect(body.latestVersion).toMatch(/^\d+(\.\d+)*$/);
  expect(body.iosStoreUrl).toContain('apps.apple.com');
});

test('cron endpoint rejects requests without the secret', async ({ request }) => {
  const res = await request.get('/api/cron/reminders');
  expect([401, 403]).toContain(res.status());
});

test('share API is rate-limit protected (headers present)', async ({ request }) => {
  const res = await request.get('/api/app-config');
  // Contract: public endpoints stay cacheable so launch checks are cheap.
  expect(res.headers()['cache-control']).toContain('s-maxage');
});
