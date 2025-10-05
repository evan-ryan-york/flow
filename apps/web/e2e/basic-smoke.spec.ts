/**
 * Basic Smoke Tests
 * Tests that key pages load without errors
 */

import { test, expect } from '@playwright/test';

test.describe('Basic Smoke Tests', () => {
  test('home page loads', async ({ page }) => {
    await page.goto('/');

    // Check if page loads without errors
    expect(page.url()).toContain('localhost:3000');

    // Wait for page to be interactive
    await page.waitForLoadState('networkidle');
  });

  test('login page loads', async ({ page }) => {
    await page.goto('/login');

    // Check URL
    await expect(page).toHaveURL(/.*login/);

    // Check for email input
    const emailInput = page.locator('input[name="email"]')
      .or(page.locator('input[type="email"]'));

    await expect(emailInput.first()).toBeVisible({ timeout: 5000 });
  });

  test('app page redirects to login when not authenticated', async ({ page }) => {
    // Clear any existing session
    await page.context().clearCookies();

    await page.goto('/app');

    // Should redirect to login
    await page.waitForURL(/.*login/, { timeout: 10000 });
  });
});

test.describe('Navigation Tests', () => {
  test('can navigate between pages', async ({ page }) => {
    await page.goto('/');

    // Click login link if it exists
    const loginLink = page.getByRole('link', { name: /login/i })
      .or(page.getByText(/sign in/i));

    if (await loginLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await loginLink.first().click();
      await expect(page).toHaveURL(/.*login/);
    }
  });
});
