import { test, expect } from '@playwright/test';

/**
 * API contract smoke: proves the serverless functions, auth gate, and
 * version-policy endpoint are alive. Safe against production.
 */

test('auth-gated API rejects unauthenticated requests', async ({ request }) => {
  for (const path of [
    '/api/dashboard',
    '/api/trips',
    '/api/search?q=test',
    // Collaboration: these expose who can reach whose trip, so an auth
    // regression here is a membership dump, not just an error.
    '/api/collaborations',
    '/api/trips/any-id/collaborators',
  ]) {
    const res = await request.get(path);
    expect(res.status(), `${path} must require auth`).toBe(401);
  }
});

test('collaboration mutations reject unauthenticated requests', async ({ request }) => {
  // A GET-only check would miss the paths that actually change membership.
  const cases: Array<[string, () => Promise<{ status: () => number }>]> = [
    ['POST /api/trips/:id/collaborators', () =>
      request.post('/api/trips/any-id/collaborators', { data: { userId: 'x', role: 'EDITOR' } })],
    ['PATCH /api/collaborations/:id', () =>
      request.patch('/api/collaborations/any-id', { data: { action: 'accept' } })],
    ['DELETE /api/collaborations/:id', () => request.delete('/api/collaborations/any-id')],
    ['DELETE /api/trips/:id/collaborators/:userId', () =>
      request.delete('/api/trips/any-id/collaborators/any-user')],
  ];
  for (const [label, call] of cases) {
    const res = await call();
    expect(res.status(), `${label} must require auth`).toBe(401);
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

test('app-config is edge-cached', async ({ request }) => {
  const res = await request.get('/api/app-config');
  // Vercel consumes the route's s-maxage for its edge cache and rewrites the
  // outgoing cache-control, so assert the edge-cache header instead. Locally
  // (no Vercel edge) the header is absent — assert the origin header then.
  const headers = res.headers();
  const cached =
    'x-vercel-cache' in headers || (headers['cache-control'] ?? '').includes('s-maxage');
  expect(cached, 'app-config must be cacheable').toBe(true);
});
