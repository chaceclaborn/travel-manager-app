import { test, expect } from '@playwright/test';

/**
 * Signed-in critical path. Requires a dedicated E2E test user:
 *   E2E_EMAIL / E2E_PASSWORD  (GitHub Actions secrets; never a real account)
 * The whole file self-skips when the secrets are absent, so the suite stays
 * green for contributors and environments without credentials.
 */

const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;

test.skip(!EMAIL || !PASSWORD, 'E2E_EMAIL / E2E_PASSWORD not configured');

test.beforeEach(async ({ page }) => {
  await page.goto('/tour');
  // Email sign-in lives behind a disclosure on the tour page.
  await page.getByRole('button', { name: /sign in with email/i }).click();
  await page.getByLabel(/email/i).fill(EMAIL!);
  await page.getByLabel(/password/i).fill(PASSWORD!);
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await page.waitForURL(/\/$/, { timeout: 15_000 });
});

test('dashboard loads with stats after sign-in', async ({ page }) => {
  await expect(page.getByText('Total Trips')).toBeVisible();
});

test('command palette opens and searches', async ({ page }) => {
  await page.keyboard.press('ControlOrMeta+k');
  await expect(page.getByPlaceholder(/search trips/i)).toBeVisible();
  await expect(page.getByText('Quick Actions')).toBeVisible();
});

test('trips page renders', async ({ page }) => {
  await page.goto('/trips');
  await expect(page.getByRole('heading', { name: /trips/i }).first()).toBeVisible();
});
