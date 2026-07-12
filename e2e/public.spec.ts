import { test, expect } from '@playwright/test';

/**
 * Public-surface smoke: no auth, safe against any environment including
 * production. These catch "the deploy is broken" — not business logic.
 */

test('tour page renders with sign-in options', async ({ page }) => {
  await page.goto('/tour');
  await expect(page.getByRole('heading', { name: 'Travel Manager' })).toBeVisible();
  await expect(page.getByRole('button', { name: /sign in with google/i }).first()).toBeVisible();
});

test('signed-out root redirects to the tour page', async ({ page }) => {
  await page.goto('/');
  await page.waitForURL(/\/tour/);
  await expect(page.getByRole('heading', { name: 'Travel Manager' })).toBeVisible();
});

test('invalid share link degrades to the "no longer shared" page', async ({ page }) => {
  await page.goto('/share/invalid-token-e2e-check');
  await expect(page.getByText('This trip is no longer shared')).toBeVisible();
});

test('legal pages render', async ({ page }) => {
  await page.goto('/privacy');
  await expect(page.getByRole('heading', { name: /privacy policy/i })).toBeVisible();
  await page.goto('/terms');
  await expect(page.getByRole('heading', { name: /terms of service/i })).toBeVisible();
  await page.goto('/support');
  await expect(page.getByRole('heading', { name: /support/i })).toBeVisible();
});

test('404 page renders for unknown routes', async ({ page }) => {
  await page.goto('/definitely-not-a-page-e2e');
  await expect(page.getByText('Page not found')).toBeVisible();
});
