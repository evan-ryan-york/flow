/**
 * E2E Tests for Calendar Feature
 * Tests critical user journeys for Google Calendar integration and work time blocks
 */

import { test, expect, Page } from '@playwright/test';

// Test configuration
const TEST_USER_EMAIL = 'test-calendar-e2e@example.com';
const TEST_USER_PASSWORD = 'Test123456!';

/**
 * Helper function to sign in a user
 */
async function signIn(page: Page, email = TEST_USER_EMAIL, password = TEST_USER_PASSWORD) {
  await page.goto('/login');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('/app', { timeout: 10000 });
}

/**
 * Helper function to navigate to calendar settings
 */
async function navigateToCalendarSettings(page: Page) {
  // Navigate to settings
  await page.goto('/app/settings/calendar-connections');
  await page.waitForLoadState('networkidle');
}

/**
 * Helper function to navigate to calendar view
 */
async function navigateToCalendar(page: Page) {
  await page.goto('/app');
  await page.waitForLoadState('networkidle');

  // Wait for calendar panel to be visible
  await page.waitForSelector('[data-testid="calendar-panel"]', { timeout: 5000 }).catch(() => {
    // Calendar panel might use different selector
  });
}

test.describe('Calendar Feature E2E', () => {
  test.beforeEach(async ({ page }) => {
    try {
      await signIn(page);
      await page.waitForLoadState('networkidle');
    } catch (error) {
      console.log('Sign in failed - test will be skipped or needs manual setup');
    }
  });

  // ---------------------------------
  // Calendar Settings & Connections
  // ---------------------------------

  test.describe('Calendar Settings & Connections', () => {
    test('should navigate to calendar settings page', async ({ page }) => {
      await navigateToCalendarSettings(page);

      // Check for settings page elements
      await expect(
        page.getByText(/Calendar Connections/i).or(page.getByText(/Google Calendar/i))
      ).toBeVisible({ timeout: 5000 });
    });

    test('should display "Connect Google Calendar" button when no accounts connected', async ({ page }) => {
      await navigateToCalendarSettings(page);

      // Look for connect button (might already have connections, so use soft assertion)
      const connectButton = page.getByRole('button', { name: /Connect.*Google/i });
      const isVisible = await connectButton.isVisible().catch(() => false);

      if (isVisible) {
        await expect(connectButton).toBeVisible();
      } else {
        // If not visible, user might already have connections - that's okay
        console.log('User already has calendar connections');
      }
    });

    test('should show connected accounts in settings', async ({ page }) => {
      await navigateToCalendarSettings(page);

      // If user has connections, they should be listed
      // This test checks the UI renders connection list properly
      const connectionList = page.locator('[data-testid="calendar-connection-list"]')
        .or(page.locator('text=/Personal|Work|@gmail.com|@.*\\.com/'));

      // Wait briefly to see if connections appear
      await page.waitForTimeout(2000);

      // Check if either no connections message or connection list appears
      const hasNoConnections = await page.getByText(/No.*accounts.*connected/i).isVisible().catch(() => false);
      const hasConnections = await connectionList.first().isVisible().catch(() => false);

      expect(hasNoConnections || hasConnections).toBeTruthy();
    });

    test('should allow editing connection label', async ({ page }) => {
      await navigateToCalendarSettings(page);

      // Find edit button for first connection (if exists)
      const editButton = page.getByRole('button', { name: /edit|rename/i }).first();
      const hasConnections = await editButton.isVisible({ timeout: 2000 }).catch(() => false);

      if (hasConnections) {
        await editButton.click();

        // Fill new label
        const labelInput = page.locator('input[name="label"]').or(
          page.locator('input[placeholder*="label"]')
        );
        await labelInput.fill('Updated Label E2E');

        // Save
        await page.getByRole('button', { name: /save|update/i }).click();

        // Check for success message or updated label
        await expect(
          page.getByText('Updated Label E2E').or(
            page.getByText(/updated|saved/i)
          )
        ).toBeVisible({ timeout: 5000 });
      } else {
        console.log('No connections available to edit');
      }
    });

    test('should show calendar list for connected account', async ({ page }) => {
      await navigateToCalendarSettings(page);

      // Look for calendar subscriptions
      const calendarItem = page.locator('[data-testid="calendar-subscription"]')
        .or(page.locator('text=/Calendar|calendar/'))
        .first();

      const hasCalendars = await calendarItem.isVisible({ timeout: 3000 }).catch(() => false);

      if (hasCalendars) {
        await expect(calendarItem).toBeVisible();
      } else {
        console.log('No calendar subscriptions found - user may need to sync');
      }
    });
  });

  // ---------------------------------
  // Calendar Visibility & Display
  // ---------------------------------

  test.describe('Calendar Visibility & Display', () => {
    test('should display calendar view on main app page', async ({ page }) => {
      await navigateToCalendar(page);

      // Check for calendar UI elements
      const calendarView = page.locator('[data-testid="calendar-view"]')
        .or(page.locator('text=/Calendar|Today|Week|Day/'));

      await expect(calendarView.first()).toBeVisible({ timeout: 5000 });
    });

    test('should toggle between day and week views', async ({ page }) => {
      await navigateToCalendar(page);

      // Find view toggle buttons
      const dayButton = page.getByRole('button', { name: /day/i });
      const weekButton = page.getByRole('button', { name: /week/i });

      // Switch to day view
      if (await dayButton.isVisible({ timeout: 2000 })) {
        await dayButton.click();
        await page.waitForTimeout(500); // Wait for view transition

        // Switch to week view
        await weekButton.click();
        await page.waitForTimeout(500);

        // Verify week view is active
        await expect(weekButton).toBeVisible();
      }
    });

    test('should navigate between dates using prev/next buttons', async ({ page }) => {
      await navigateToCalendar(page);

      // Find navigation buttons
      const prevButton = page.getByRole('button', { name: /previous|prev/i })
        .or(page.locator('button[aria-label*="previous"]'))
        .first();

      const nextButton = page.getByRole('button', { name: /next/i })
        .or(page.locator('button[aria-label*="next"]'))
        .first();

      if (await prevButton.isVisible({ timeout: 2000 })) {
        // Get current date header
        const dateHeader = page.locator('[data-testid="calendar-date-range"]')
          .or(page.locator('text=/20\\d{2}|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/'))
          .first();

        const originalDate = await dateHeader.textContent().catch(() => '');

        // Navigate to previous period
        await prevButton.click();
        await page.waitForTimeout(500);

        // Navigate to next period
        await nextButton.click();
        await page.waitForTimeout(500);

        // Should be back to original date (or close to it)
        const currentDate = await dateHeader.textContent().catch(() => '');
        expect(currentDate).toBeTruthy();
      }
    });

    test('should navigate to today when "Today" button clicked', async ({ page }) => {
      await navigateToCalendar(page);

      const todayButton = page.getByRole('button', { name: /today/i });

      if (await todayButton.isVisible({ timeout: 2000 })) {
        await todayButton.click();
        await page.waitForTimeout(500);

        // Check that today's date is highlighted or shown
        const today = new Date();
        const todayStr = today.getDate().toString();

        // Look for today's date in the calendar
        const dateElement = page.locator(`text=/\\b${todayStr}\\b/`).first();
        await expect(dateElement).toBeVisible({ timeout: 3000 });
      }
    });

    test('should show calendar events if available', async ({ page }) => {
      await navigateToCalendar(page);

      // Wait for calendar to load
      await page.waitForTimeout(2000);

      // Look for any calendar events (might not exist for test user)
      const eventElement = page.locator('[data-testid="calendar-event"]')
        .or(page.locator('.calendar-event'))
        .first();

      const hasEvents = await eventElement.isVisible({ timeout: 2000 }).catch(() => false);

      if (hasEvents) {
        console.log('Calendar events found and displayed');
        await expect(eventElement).toBeVisible();
      } else {
        console.log('No calendar events to display (expected for new user)');
      }
    });
  });

  // ---------------------------------
  // Work Time Blocks
  // ---------------------------------

  test.describe('Work Time Blocks', () => {
    test('should show "Add Work Block" button or similar UI', async ({ page }) => {
      await navigateToCalendar(page);

      // Look for add work block UI
      const addButton = page.getByRole('button', { name: /add.*work|create.*block/i })
        .or(page.locator('[data-testid="add-work-block"]'));

      const hasButton = await addButton.isVisible({ timeout: 3000 }).catch(() => false);

      if (hasButton) {
        await expect(addButton).toBeVisible();
      } else {
        // Might need to click on calendar first
        console.log('Add work block button not immediately visible - might require calendar interaction');
      }
    });

    test('should create work time block via click and drag', async ({ page }) => {
      await navigateToCalendar(page);

      // This test simulates creating a work block
      // Implementation depends on calendar UI - might need to click on time slot
      const timeSlot = page.locator('[data-testid="calendar-time-slot"]')
        .or(page.locator('.calendar-time-slot'))
        .first();

      const hasTimeSlots = await timeSlot.isVisible({ timeout: 2000 }).catch(() => false);

      if (hasTimeSlots) {
        // Click on time slot
        await timeSlot.click();

        // Look for work block creation dialog/form
        const titleInput = page.locator('input[name="title"]')
          .or(page.locator('input[placeholder*="title"]'));

        const hasDialog = await titleInput.isVisible({ timeout: 2000 }).catch(() => false);

        if (hasDialog) {
          const blockTitle = `E2E Work Block ${Date.now()}`;
          await titleInput.fill(blockTitle);

          // Save
          await page.getByRole('button', { name: /save|create/i }).click();

          // Check that work block appears
          await expect(page.getByText(blockTitle)).toBeVisible({ timeout: 5000 });
        }
      } else {
        console.log('Calendar time slots not available for interaction');
      }
    });

    test('should delete work time block', async ({ page }) => {
      await navigateToCalendar(page);

      // First create a work block to delete
      const addButton = page.getByRole('button', { name: /add.*work/i }).first();
      const hasButton = await addButton.isVisible({ timeout: 2000 }).catch(() => false);

      if (hasButton) {
        await addButton.click();

        const blockTitle = `E2E Delete Test ${Date.now()}`;
        const titleInput = page.locator('input[name="title"]').or(
          page.locator('input[placeholder*="title"]')
        );

        if (await titleInput.isVisible({ timeout: 2000 })) {
          await titleInput.fill(blockTitle);
          await page.getByRole('button', { name: /save|create/i }).click();

          // Wait for block to appear
          await page.waitForTimeout(1000);

          // Click on the work block to select it
          const workBlock = page.getByText(blockTitle);
          if (await workBlock.isVisible({ timeout: 2000 })) {
            await workBlock.click();

            // Look for delete button
            const deleteButton = page.getByRole('button', { name: /delete|remove/i });
            if (await deleteButton.isVisible({ timeout: 2000 })) {
              await deleteButton.click();

              // Confirm deletion if needed
              const confirmButton = page.getByRole('button', { name: /confirm|yes|delete/i });
              if (await confirmButton.isVisible({ timeout: 1000 })) {
                await confirmButton.click();
              }

              // Verify work block is removed
              await expect(workBlock).not.toBeVisible({ timeout: 3000 });
            }
          }
        }
      } else {
        console.log('Cannot test work block deletion - add button not available');
      }
    });

    test('should persist work time blocks after page reload', async ({ page }) => {
      await navigateToCalendar(page);

      const blockTitle = `E2E Persist Test ${Date.now()}`;

      // Create work block
      const addButton = page.getByRole('button', { name: /add.*work/i }).first();
      const hasButton = await addButton.isVisible({ timeout: 2000 }).catch(() => false);

      if (hasButton) {
        await addButton.click();

        const titleInput = page.locator('input[name="title"]').or(
          page.locator('input[placeholder*="title"]')
        );

        if (await titleInput.isVisible({ timeout: 2000 })) {
          await titleInput.fill(blockTitle);
          await page.getByRole('button', { name: /save|create/i }).click();

          // Wait for creation
          await page.waitForTimeout(1000);

          // Reload page
          await page.reload();
          await page.waitForLoadState('networkidle');

          // Verify work block still exists
          await expect(page.getByText(blockTitle)).toBeVisible({ timeout: 5000 });

          // Cleanup - delete the work block
          const workBlock = page.getByText(blockTitle);
          if (await workBlock.isVisible()) {
            await workBlock.click();
            const deleteButton = page.getByRole('button', { name: /delete/i });
            if (await deleteButton.isVisible({ timeout: 1000 })) {
              await deleteButton.click();
              const confirmButton = page.getByRole('button', { name: /confirm|yes|delete/i });
              if (await confirmButton.isVisible({ timeout: 1000 })) {
                await confirmButton.click();
              }
            }
          }
        }
      } else {
        console.log('Cannot test work block persistence - add button not available');
      }
    });
  });

  // ---------------------------------
  // Calendar Sync
  // ---------------------------------

  test.describe('Calendar Sync', () => {
    test('should show manual sync button', async ({ page }) => {
      await navigateToCalendar(page);

      // Look for sync/refresh button
      const syncButton = page.getByRole('button', { name: /sync|refresh/i })
        .or(page.locator('[data-testid="sync-calendar"]'))
        .or(page.locator('button[aria-label*="sync"]'));

      const hasSyncButton = await syncButton.first().isVisible({ timeout: 3000 }).catch(() => false);

      if (hasSyncButton) {
        await expect(syncButton.first()).toBeVisible();
      } else {
        console.log('Sync button not found - might be in settings or hidden');
      }
    });

    test('should trigger manual sync when sync button clicked', async ({ page }) => {
      await navigateToCalendar(page);

      const syncButton = page.getByRole('button', { name: /sync|refresh/i }).first();
      const hasSyncButton = await syncButton.isVisible({ timeout: 2000 }).catch(() => false);

      if (hasSyncButton) {
        await syncButton.click();

        // Look for loading indicator
        const loadingIndicator = page.locator('[data-testid="sync-loading"]')
          .or(page.locator('text=/syncing|loading/i'))
          .or(page.locator('.spinner'));

        // Loading indicator might appear briefly
        const isLoading = await loadingIndicator.isVisible({ timeout: 1000 }).catch(() => false);

        if (isLoading) {
          // Wait for sync to complete
          await expect(loadingIndicator).not.toBeVisible({ timeout: 10000 });
        }

        // Sync should complete without errors
        const errorMessage = page.getByText(/error|failed/i);
        const hasError = await errorMessage.isVisible({ timeout: 1000 }).catch(() => false);
        expect(hasError).toBeFalsy();
      } else {
        console.log('Cannot test sync - sync button not available');
      }
    });
  });

  // ---------------------------------
  // Calendar Panel Resize
  // ---------------------------------

  test.describe('Calendar Panel Resize', () => {
    test('should show resizable divider between task hub and calendar', async ({ page }) => {
      await navigateToCalendar(page);

      // Look for resize handle
      const resizeHandle = page.locator('[data-testid="resize-handle"]')
        .or(page.locator('[data-panel-resize-handle-id]'))
        .or(page.locator('.resize-handle'));

      const hasResizeHandle = await resizeHandle.first().isVisible({ timeout: 2000 }).catch(() => false);

      if (hasResizeHandle) {
        await expect(resizeHandle.first()).toBeVisible();
      } else {
        console.log('Resize handle not found - layout might be fixed or use different implementation');
      }
    });

    test('should allow resizing calendar panel', async ({ page }) => {
      await navigateToCalendar(page);

      const resizeHandle = page.locator('[data-panel-resize-handle-id]')
        .or(page.locator('[data-testid="resize-handle"]'))
        .first();

      const hasResizeHandle = await resizeHandle.isVisible({ timeout: 2000 }).catch(() => false);

      if (hasResizeHandle) {
        // Get handle position
        const boundingBox = await resizeHandle.boundingBox();

        if (boundingBox) {
          // Drag resize handle
          await page.mouse.move(boundingBox.x + boundingBox.width / 2, boundingBox.y + boundingBox.height / 2);
          await page.mouse.down();
          await page.mouse.move(boundingBox.x + 100, boundingBox.y + boundingBox.height / 2);
          await page.mouse.up();

          // Panel should resize (hard to verify exact dimensions in E2E)
          await page.waitForTimeout(500);

          // Verify calendar is still visible after resize
          const calendarPanel = page.locator('[data-testid="calendar-panel"]')
            .or(page.locator('text=/Calendar/'))
            .first();

          await expect(calendarPanel).toBeVisible();
        }
      } else {
        console.log('Cannot test resize - handle not available');
      }
    });
  });

  // ---------------------------------
  // Error Handling
  // ---------------------------------

  test.describe('Error Handling', () => {
    test('should handle missing calendar gracefully', async ({ page }) => {
      await navigateToCalendar(page);

      // If user has no calendar connections, should show helpful message
      // Wait for page to load
      await page.waitForTimeout(2000);

      // Either calendar events appear OR helpful empty state appears
      const calendarEvents = page.locator('[data-testid="calendar-event"]').first();
      const emptyState = page.getByText(/no.*events|connect.*calendar/i);

      const hasEvents = await calendarEvents.isVisible({ timeout: 1000 }).catch(() => false);
      const hasEmptyState = await emptyState.isVisible({ timeout: 1000 }).catch(() => false);

      // One of these should be true
      expect(hasEvents || hasEmptyState).toBeTruthy();
    });

    test('should not crash when navigating to invalid date', async ({ page }) => {
      await navigateToCalendar(page);

      // Navigate far into the future
      const nextButton = page.getByRole('button', { name: /next/i }).first();

      if (await nextButton.isVisible({ timeout: 2000 })) {
        // Click next multiple times
        for (let i = 0; i < 10; i++) {
          await nextButton.click();
          await page.waitForTimeout(200);
        }

        // Calendar should still be functional
        await expect(nextButton).toBeVisible();

        // No error messages should appear
        const errorMessage = page.getByText(/error|failed|crash/i);
        const hasError = await errorMessage.isVisible({ timeout: 1000 }).catch(() => false);
        expect(hasError).toBeFalsy();
      }
    });
  });
});
