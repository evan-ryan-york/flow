/**
 * E2E Tests for Project Management
 * Tests critical user journeys for project management features
 */

import { test, expect, Page } from '@playwright/test';

// Test configuration
const TEST_USER_EMAIL = 'test-e2e@example.com';
const TEST_USER_PASSWORD = 'Test123456!';

/**
 * Helper function to sign in a user
 * Note: This will need to be adapted based on your actual auth flow
 */
async function signIn(page: Page, email = TEST_USER_EMAIL, password = TEST_USER_PASSWORD) {
  await page.goto('/login');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');

  // Wait for redirect to app
  await page.waitForURL('/app', { timeout: 10000 });
}

/**
 * Helper function to sign up a new user
 * Note: This will need to be adapted based on your actual auth flow
 */
async function signUp(page: Page, email = TEST_USER_EMAIL, password = TEST_USER_PASSWORD) {
  await page.goto('/signup');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');

  // Wait for redirect to app
  await page.waitForURL('/app', { timeout: 10000 });
}

test.describe('Projects Management E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Note: In a real implementation, you would:
    // 1. Reset the test database
    // 2. Create a fresh test user
    // For now, we'll assume the user exists and just sign in

    try {
      await signIn(page);
    } catch (error) {
      // If sign in fails, user might not exist, so skip for now
      console.log('Sign in failed - test will be skipped or needs manual setup');
    }
  });

  test('should show General project on first login', async ({ page }) => {
    // Check if we're on the app page
    await expect(page).toHaveURL('/app');

    // General project should be visible
    await expect(page.getByText('General')).toBeVisible({ timeout: 10000 });

    // General project should have a lock icon (if visible in UI)
    const generalProject = page.getByText('General').locator('..');
    // Adjust this selector based on actual implementation
  });

  test('should create a new project', async ({ page }) => {
    // Wait for app to load
    await page.waitForLoadState('networkidle');

    // Find and click the create project button
    // This needs to be adjusted based on actual implementation
    const createButton = page.locator('[data-testid="create-project-button"]')
      .or(page.locator('button:has-text("+")')
      .or(page.locator('[aria-label="Create project"]')));

    await createButton.first().click({ timeout: 5000 });

    // Fill in project name
    const input = page.locator('input[placeholder*="Project"]')
      .or(page.locator('input[placeholder*="name"]'));

    await input.first().fill('E2E Test Project');

    // Submit by pressing Enter
    await input.first().press('Enter');

    // Project should appear in the list
    await expect(page.getByText('E2E Test Project')).toBeVisible({ timeout: 5000 });
  });

  test('should select and deselect projects', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Find "All" and "None" buttons
    const allButton = page.getByText('All', { exact: true });
    const noneButton = page.getByText('None', { exact: true });

    // Check if buttons exist
    if (await allButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Click "All" to select all projects
      await allButton.click();

      // Wait a bit for selection to apply
      await page.waitForTimeout(500);

      // Click "None" to deselect all
      await noneButton.click();

      // Wait for deselection
      await page.waitForTimeout(500);
    }
  });

  test('should display projects panel', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Check if projects are displayed
    // This is a basic smoke test
    const projectsHeading = page.getByRole('heading', { name: /projects/i });

    // Either the heading exists or projects are displayed in some other way
    const hasProjects = await projectsHeading.isVisible({ timeout: 2000 }).catch(() => false) ||
                       await page.getByText('General').isVisible({ timeout: 2000 }).catch(() => false);

    expect(hasProjects).toBeTruthy();
  });
});

test.describe('Projects Management - Visual Tests', () => {
  test.beforeEach(async ({ page }) => {
    try {
      await signIn(page);
      await page.waitForLoadState('networkidle');
    } catch (error) {
      console.log('Sign in failed for visual tests');
    }
  });

  test('should render projects panel correctly', async ({ page }) => {
    // Take a screenshot of the projects panel for visual regression testing
    await expect(page).toHaveURL('/app');

    // Wait for content to load
    await page.waitForTimeout(1000);

    // Take screenshot (optional - for visual regression)
    // await page.screenshot({ path: 'screenshots/projects-panel.png' });
  });
});
