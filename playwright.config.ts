import { defineConfig, devices } from '@playwright/test';

/**
 * E2E suite. Runs against whatever BASE_URL points at:
 *   - CI (e2e.yml): the Vercel preview deployment for the commit
 *   - smoke (smoke.yml): production, on a weekly schedule
 *   - locally: `BASE_URL=http://localhost:3000 yarn e2e` (start `yarn local` first)
 *
 * VERCEL_AUTOMATION_BYPASS_SECRET is forwarded as the protection-bypass
 * header so tests can reach password-protected preview deployments.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  timeout: 30_000,
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    extraHTTPHeaders: process.env.VERCEL_AUTOMATION_BYPASS_SECRET
      ? { 'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET }
      : {},
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 13'] },
      // Mobile run covers only the public client-facing pages — the share
      // page is most often opened from a phone.
      testMatch: /public\.spec\.ts/,
    },
  ],
});
