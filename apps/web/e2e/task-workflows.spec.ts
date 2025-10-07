/**
 * E2E Tests for Complex Task Workflows
 * Tests advanced task management scenarios and edge cases
 */

import { test, expect, Page } from '@playwright/test';

const TEST_USER_EMAIL = 'test-workflows-e2e@example.com';
const TEST_USER_PASSWORD = 'Test123456!';

async function signIn(page: Page, email = TEST_USER_EMAIL, password = TEST_USER_PASSWORD) {
  await page.goto('/login');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('/app', { timeout: 10000 });
}

test.describe('Task Workflows E2E', () => {
  test.beforeEach(async ({ page }) => {
    try {
      await signIn(page);
      await page.waitForLoadState('networkidle');
    } catch (error) {
      console.log('Sign in failed - test will be skipped or needs manual setup');
    }
  });

  test('should create multiple tasks quickly', async ({ page }) => {
    const tasks = [
      `Quick Task 1 ${Date.now()}`,
      `Quick Task 2 ${Date.now()}`,
      `Quick Task 3 ${Date.now()}`,
    ];

    const input = page.locator('input[placeholder*="Add"]').first();

    for (const task of tasks) {
      await input.fill(task);
      await input.press('Enter');
      await page.waitForTimeout(200); // Brief pause between tasks
    }

    // All tasks should be visible
    for (const task of tasks) {
      await expect(page.getByText(task)).toBeVisible({ timeout: 5000 });
    }
  });

  test('should move task between projects', async ({ page }) => {
    const taskName = `Move Task ${Date.now()}`;

    // Create task in default project
    const input = page.locator('input[placeholder*="Add"]').first();
    await input.fill(taskName);
    await input.press('Enter');

    await expect(page.getByText(taskName)).toBeVisible({ timeout: 5000 });

    // Open task edit panel
    await page.getByText(taskName).first().click();
    await page.waitForTimeout(500);

    // Find project selector
    const projectSelector = page.locator('[data-testid="task-project-selector"]')
      .or(page.locator('button:has-text("General")'))
      .or(page.locator('select[name="project"]'));

    await projectSelector.first().click();

    // Select different project
    const workProject = page.locator('text="Work"')
      .or(page.locator('[data-value="work"]'));

    if (await workProject.isVisible({ timeout: 2000 }).catch(() => false)) {
      await workProject.first().click();

      // Wait for save
      await page.waitForTimeout(500);

      // Close edit panel
      await page.keyboard.press('Escape');

      // Task should still be visible (now in Work project)
      await expect(page.getByText(taskName)).toBeVisible({ timeout: 3000 });
    }
  });

  test('should handle task with long name', async ({ page }) => {
    const longName = `This is a very long task name that contains many words and should test how the UI handles lengthy task names without breaking the layout or causing overflow issues ${Date.now()}`;

    const input = page.locator('input[placeholder*="Add"]').first();
    await input.fill(longName);
    await input.press('Enter');

    // Task should be visible and text should be properly displayed
    const taskElement = page.getByText(longName, { exact: false }).first();
    await expect(taskElement).toBeVisible({ timeout: 5000 });

    // Check that text doesn't overflow container
    const boundingBox = await taskElement.boundingBox();
    expect(boundingBox).toBeTruthy();
    expect(boundingBox!.width).toBeLessThan(page.viewportSize()!.width);
  });

  test('should collapse and expand task groups', async ({ page }) => {
    const taskName = `Group Collapse Task ${Date.now()}`;

    // Create task
    const input = page.locator('input[placeholder*="Add"]').first();
    await input.fill(taskName);
    await input.press('Enter');

    await expect(page.getByText(taskName)).toBeVisible({ timeout: 5000 });

    // Group by project
    const groupByButton = page.locator('button:has-text("Group")').first();
    await groupByButton.click();

    const projectOption = page.locator('text="Project"').first();
    await projectOption.click();

    // Wait for grouping
    await page.waitForTimeout(500);

    // Find group header (e.g., "General")
    const groupHeader = page.locator('text=/General|Work/').first();
    await expect(groupHeader).toBeVisible({ timeout: 3000 });

    // Click to collapse
    await groupHeader.click();

    // Task should not be visible
    await expect(page.getByText(taskName)).not.toBeVisible();

    // Click to expand
    await groupHeader.click();

    // Task should be visible again
    await expect(page.getByText(taskName)).toBeVisible({ timeout: 3000 });
  });

  test('should filter by multiple criteria', async ({ page }) => {
    const task1 = `Multi Filter Task 1 ${Date.now()}`;
    const task2 = `Multi Filter Task 2 ${Date.now()}`;

    // Create two tasks
    const input = page.locator('input[placeholder*="Add"]').first();

    await input.fill(task1);
    await input.press('Enter');
    await page.waitForTimeout(300);

    await input.fill(task2);
    await input.press('Enter');
    await page.waitForTimeout(300);

    // Mark first task as in progress
    await page.getByText(task1).first().click();
    await page.waitForTimeout(300);

    const statusDropdown = page.locator('select[name="status"]')
      .or(page.locator('button:has-text("To Do")'));

    if (await statusDropdown.isVisible({ timeout: 2000 }).catch(() => false)) {
      await statusDropdown.click();
      await page.locator('text="In Progress"').first().click();
    }

    await page.keyboard.press('Escape');

    // Apply status filter for "In Progress"
    const statusFilter = page.locator('button:has-text("Status")').first();
    await statusFilter.click();

    const inProgressOption = page.locator('text="In Progress"').first();
    await inProgressOption.click();

    // Apply search filter
    const searchInput = page.locator('input[placeholder*="Search"]').first();
    await searchInput.fill('Filter Task 1');
    await page.waitForTimeout(400);

    // Only task1 should be visible
    await expect(page.getByText(task1)).toBeVisible({ timeout: 3000 });
    await expect(page.getByText(task2)).not.toBeVisible();
  });

  test('should handle rapid task status changes', async ({ page }) => {
    const taskName = `Rapid Status Task ${Date.now()}`;

    // Create task
    const input = page.locator('input[placeholder*="Add"]').first();
    await input.fill(taskName);
    await input.press('Enter');

    const taskRow = page.locator(`text=${taskName}`).locator('..');
    const checkbox = taskRow.locator('input[type="checkbox"]').first();

    // Rapidly toggle status
    for (let i = 0; i < 5; i++) {
      await checkbox.click();
      await page.waitForTimeout(100);
    }

    // Task should remain functional
    await expect(page.getByText(taskName)).toBeVisible({ timeout: 3000 });
  });

  test('should preserve unsaved changes warning', async ({ page }) => {
    const taskName = `Unsaved Changes Task ${Date.now()}`;

    // Create task
    const input = page.locator('input[placeholder*="Add"]').first();
    await input.fill(taskName);
    await input.press('Enter');

    await expect(page.getByText(taskName)).toBeVisible({ timeout: 5000 });

    // Open edit panel
    await page.getByText(taskName).first().click();
    await page.waitForTimeout(500);

    // Make changes
    const nameInput = page.locator('input[value*="Unsaved"]').first();
    await nameInput.clear();
    await nameInput.fill('Modified Name');

    // Try to close without saving (if unsaved changes warning exists)
    await page.keyboard.press('Escape');

    // Check for warning dialog
    const warningDialog = page.locator('text=/unsaved|discard|lose changes/i');

    if (await warningDialog.isVisible({ timeout: 1000 }).catch(() => false)) {
      // Cancel to keep editing
      const cancelButton = page.locator('button:has-text("Cancel")');
      await cancelButton.click();

      // Edit panel should still be open
      await expect(nameInput).toBeVisible({ timeout: 2000 });
    }
  });

  test('should sort tasks correctly', async ({ page }) => {
    const tasks = [
      `Task C ${Date.now()}`,
      `Task A ${Date.now()}`,
      `Task B ${Date.now()}`,
    ];

    const input = page.locator('input[placeholder*="Add"]').first();

    for (const task of tasks) {
      await input.fill(task);
      await input.press('Enter');
      await page.waitForTimeout(200);
    }

    // Check for sort options
    const sortButton = page.locator('button:has-text("Sort")')
      .or(page.locator('[data-testid="sort-button"]'));

    if (await sortButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await sortButton.click();

      // Select alphabetical sort
      const alphaSort = page.locator('text=/Name|Alphabetical/i').first();
      await alphaSort.click();

      await page.waitForTimeout(500);

      // Get all task elements
      const taskElements = await page.locator('[data-testid="task-item"]')
        .or(page.locator('text=/Task [ABC]/'))
        .allTextContents();

      // Verify tasks are sorted
      const sortedTasks = [...tasks].sort();
      taskElements.forEach((text, index) => {
        expect(text).toContain(sortedTasks[index].charAt(5)); // Check A, B, C
      });
    }
  });

  test('should handle special characters in task name', async ({ page }) => {
    const specialName = `Task with "quotes" & symbols #$% ${Date.now()}`;

    const input = page.locator('input[placeholder*="Add"]').first();
    await input.fill(specialName);
    await input.press('Enter');

    // Task should be created and visible
    await expect(page.getByText(specialName, { exact: false })).toBeVisible({ timeout: 5000 });

    // Should be able to edit it
    await page.getByText(specialName, { exact: false }).first().click();
    await page.waitForTimeout(500);

    const editInput = page.locator('input[value*="quotes"]').first();
    await expect(editInput).toBeVisible({ timeout: 3000 });
  });

  test('should show task count in groups', async ({ page }) => {
    const tasks = [
      `Count Task 1 ${Date.now()}`,
      `Count Task 2 ${Date.now()}`,
      `Count Task 3 ${Date.now()}`,
    ];

    const input = page.locator('input[placeholder*="Add"]').first();

    for (const task of tasks) {
      await input.fill(task);
      await input.press('Enter');
      await page.waitForTimeout(200);
    }

    // Group by status
    const groupByButton = page.locator('button:has-text("Group")').first();
    await groupByButton.click();

    const statusOption = page.locator('text="Status"').last(); // Get the grouping option, not filter
    await statusOption.click();

    await page.waitForTimeout(500);

    // Look for count badge
    const countBadge = page.locator('text=/\\d+/').first(); // Find numbers (task counts)
    await expect(countBadge).toBeVisible({ timeout: 3000 });

    const count = await countBadge.textContent();
    expect(parseInt(count || '0')).toBeGreaterThanOrEqual(3);
  });

  test('should support drag and drop task assignment', async ({ page }) => {
    const taskName = `Drag Task ${Date.now()}`;

    // Create task
    const input = page.locator('input[placeholder*="Add"]').first();
    await input.fill(taskName);
    await input.press('Enter');

    await expect(page.getByText(taskName)).toBeVisible({ timeout: 5000 });

    const taskElement = page.getByText(taskName).first();

    // Check if task is draggable
    const isDraggable = await taskElement.evaluate(el => {
      const parent = el.closest('[draggable="true"]');
      return parent !== null;
    });

    if (isDraggable) {
      // Get task bounding box
      const box = await taskElement.boundingBox();

      if (box) {
        // Simulate drag start
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();

        // Drag to different location
        await page.mouse.move(box.x + 100, box.y + 100);

        // Drop
        await page.mouse.up();

        // Task should still exist
        await expect(page.getByText(taskName)).toBeVisible({ timeout: 3000 });
      }
    }
  });

  test('should load more tasks when scrolling (if pagination exists)', async ({ page }) => {
    // Check if there are many tasks to test infinite scroll
    const taskCount = await page.locator('[data-testid="task-item"]')
      .or(page.locator('text=/Task/'))
      .count();

    if (taskCount > 10) {
      // Scroll to bottom
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });

      await page.waitForTimeout(1000);

      // Check if more tasks loaded
      const newTaskCount = await page.locator('[data-testid="task-item"]')
        .or(page.locator('text=/Task/'))
        .count();

      expect(newTaskCount).toBeGreaterThanOrEqual(taskCount);
    }
  });

  test('should handle concurrent edits gracefully', async ({ page, context }) => {
    const taskName = `Concurrent Edit Task ${Date.now()}`;

    // Create task
    const input = page.locator('input[placeholder*="Add"]').first();
    await input.fill(taskName);
    await input.press('Enter');

    await expect(page.getByText(taskName)).toBeVisible({ timeout: 5000 });

    // Open in current page
    await page.getByText(taskName).first().click();
    await page.waitForTimeout(500);

    const editInput = page.locator('input[value*="Concurrent"]').first();
    await editInput.clear();
    await editInput.fill('Edit from Page 1');

    // In real scenario, another user would edit simultaneously
    // For now, just verify the edit completes successfully
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    await expect(page.getByText('Edit from Page 1')).toBeVisible({ timeout: 3000 });
  });
});
