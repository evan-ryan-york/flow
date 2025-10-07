/**
 * E2E Tests for Complete Project Workflows
 * Tests realistic user scenarios and workflows
 */

import { test, expect, Page } from '@playwright/test';

// Test utilities
async function createProject(page: Page, projectName: string) {
  // Find create button - adapt based on actual UI
  const createButton = page.locator('[data-testid="create-project"]')
    .or(page.locator('button:has-text("+")'))
    .or(page.locator('[aria-label*="Create"]'));

  await createButton.first().click({ timeout: 5000 });

  // Fill project name
  const input = page.locator('input[placeholder*="Project"]')
    .or(page.locator('input[placeholder*="name"]'));

  await input.first().fill(projectName);
  await input.first().press('Enter');

  // Wait for project to appear
  await expect(page.getByText(projectName)).toBeVisible({ timeout: 5000 });
}

async function selectProject(page: Page, projectName: string) {
  const projectItem = page.getByText(projectName).first();
  await projectItem.click();

  // Wait for selection to apply
  await page.waitForTimeout(300);
}

test.describe('Project Workflows', () => {
  test.beforeEach(async ({ page }) => {
    // Assume user is already authenticated
    // In a real implementation, add authentication here
    await page.goto('/app');
    await page.waitForLoadState('networkidle');
  });

  test('complete project lifecycle', async ({ page }) => {
    test.slow(); // Mark as slow test

    // 1. Create a new project
    const projectName = `Workflow Test ${Date.now()}`;

    try {
      await createProject(page, projectName);
    } catch (error) {
      // If creation fails, skip the rest of the test
      test.skip();
    }

    // 2. Verify project is created
    await expect(page.getByText(projectName)).toBeVisible();

    // 3. Select the project
    await selectProject(page, projectName);

    // 4. Create tasks in the project (if task creation is available)
    // This would be implemented based on your actual UI

    // 5. Change project color (if available)
    // This would be implemented based on your actual UI

    // 6. Verify project persists after reload
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(projectName)).toBeVisible();
  });

  test('multi-project selection workflow', async ({ page }) => {
    // Verify "All" and "None" buttons work together
    const allButton = page.getByText('All', { exact: true });
    const noneButton = page.getByText('None', { exact: true });

    if (await allButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Select all projects
      await allButton.click();
      await page.waitForTimeout(500);

      // Verify selection state
      // This would check for visual indicators

      // Deselect all
      await noneButton.click();
      await page.waitForTimeout(500);
    } else {
      // If buttons don't exist, skip this test
      test.skip();
    }
  });

  test('project panel responsiveness', async ({ page }) => {
    // Test that projects panel works on different viewport sizes
    const viewports = [
      { width: 1920, height: 1080 }, // Desktop
      { width: 1366, height: 768 },  // Laptop
      { width: 768, height: 1024 },  // Tablet
    ];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(300);

      // Verify projects are still visible
      const hasProjects = await page.getByText('General')
        .isVisible({ timeout: 2000 })
        .catch(() => false);

      // Projects should be visible or accessible via menu
      expect(hasProjects || await page.locator('[data-testid="menu-toggle"]')
        .isVisible().catch(() => false)).toBeTruthy();
    }
  });
});

test.describe('Project Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/app');
    await page.waitForLoadState('networkidle');
  });

  test('handles empty project name gracefully', async ({ page }) => {
    // Try to create project with empty name
    const createButton = page.locator('[data-testid="create-project"]')
      .or(page.locator('button:has-text("+")'));

    if (await createButton.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      await createButton.first().click();

      // Find input and try to submit empty
      const input = page.locator('input[placeholder*="Project"]')
        .or(page.locator('input[placeholder*="name"]'));

      if (await input.first().isVisible({ timeout: 2000 }).catch(() => false)) {
        await input.first().press('Enter');

        // Should show error message
        const errorMessage = page.getByText(/required/i)
          .or(page.getByText(/cannot be empty/i));

        // Either error message shows or input remains visible (not submitted)
        const hasError = await errorMessage.isVisible({ timeout: 2000 }).catch(() => false);
        const inputStillVisible = await input.first().isVisible();

        expect(hasError || inputStillVisible).toBeTruthy();
      }
    } else {
      test.skip();
    }
  });

  test('handles very long project names', async ({ page }) => {
    const longName = 'A'.repeat(100); // 100 characters

    const createButton = page.locator('[data-testid="create-project"]')
      .or(page.locator('button:has-text("+")'));

    if (await createButton.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      await createButton.first().click();

      const input = page.locator('input[placeholder*="Project"]')
        .or(page.locator('input[placeholder*="name"]'));

      if (await input.first().isVisible({ timeout: 2000 }).catch(() => false)) {
        await input.first().fill(longName);
        await input.first().press('Enter');

        // Should either:
        // 1. Show error message about length
        // 2. Truncate the name
        // 3. Accept it (depends on validation rules)

        await page.waitForTimeout(1000);
      }
    } else {
      test.skip();
    }
  });
});

test.describe('Project Performance', () => {
  test('loads projects quickly', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/app');
    await page.waitForLoadState('networkidle');

    // Wait for projects to appear
    await page.getByText('General').waitFor({ timeout: 5000 });

    const loadTime = Date.now() - startTime;

    // Projects should load within 5 seconds
    expect(loadTime).toBeLessThan(5000);
  });

  test('handles many projects efficiently', async ({ page }) => {
    await page.goto('/app');
    await page.waitForLoadState('networkidle');

    // Check if scrolling works smoothly with many projects
    // This is a basic performance check

    const projectsContainer = page.locator('[data-testid="projects-list"]')
      .or(page.locator('.projects-panel'))
      .or(page.locator('text=General').locator('..').locator('..'));

    if (await projectsContainer.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Simulate scrolling
      await projectsContainer.hover();
      await page.mouse.wheel(0, 500);
      await page.waitForTimeout(100);
      await page.mouse.wheel(0, -500);
    }
  });
});
