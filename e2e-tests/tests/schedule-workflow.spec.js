/**
 * End-to-End Schedule Management Workflow Tests
 * Tests complete schedule creation, editing, and optimization workflows
 */

const { test, expect } = require('@playwright/test');

test.describe('Schedule Management Workflows', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'manager@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');
    await expect(page).toHaveURL('/dashboard');
  });

  test.describe('Schedule Creation', () => {
    test('should create a new schedule successfully', async ({ page }) => {
      // Navigate to schedules page
      await page.click('[data-testid="nav-schedules"]');
      await expect(page).toHaveURL('/schedules');

      // Click create new schedule
      await page.click('[data-testid="create-schedule-button"]');

      // Fill schedule details
      await page.fill('[data-testid="schedule-name"]', 'Week of January 15-21');
      await page.fill('[data-testid="start-date"]', '2024-01-15');
      await page.fill('[data-testid="end-date"]', '2024-01-21');

      // Generate schedule
      await page.click('[data-testid="generate-schedule-button"]');

      // Wait for generation to complete
      await expect(page.locator('[data-testid="generation-progress"]')).toBeVisible();
      await expect(page.locator('[data-testid="generation-progress"]')).not.toBeVisible({ timeout: 30000 });

      // Verify schedule was created
      await expect(page.locator('[data-testid="schedule-view"]')).toBeVisible();
      await expect(page.locator('text=Week of January 15-21')).toBeVisible();

      // Verify shifts are displayed
      await expect(page.locator('[data-testid="shift-card"]')).toHaveCount.greaterThan(0);
    });

    test('should handle schedule generation with constraints', async ({ page }) => {
      // First add some rules
      await page.click('[data-testid="nav-rules"]');
      await page.click('[data-testid="add-rule-button"]');

      await page.fill('[data-testid="rule-input"]', 'Sarah cannot work past 5pm on weekdays');
      await page.click('[data-testid="parse-rule-button"]');

      await expect(page.locator('[data-testid="rule-preview"]')).toBeVisible();
      await page.click('[data-testid="confirm-rule-button"]');

      // Now create schedule
      await page.click('[data-testid="nav-schedules"]');
      await page.click('[data-testid="create-schedule-button"]');

      await page.fill('[data-testid="schedule-name"]', 'Constrained Schedule');
      await page.fill('[data-testid="start-date"]', '2024-01-22');
      await page.fill('[data-testid="end-date"]', '2024-01-28');

      await page.click('[data-testid="generate-schedule-button"]');

      // Wait for generation
      await expect(page.locator('[data-testid="generation-progress"]')).not.toBeVisible({ timeout: 30000 });

      // Verify constraints were applied
      await expect(page.locator('[data-testid="constraints-applied"]')).toBeVisible();
      await expect(page.locator('text=1 rule applied')).toBeVisible();
    });

    test('should validate schedule parameters', async ({ page }) => {
      await page.click('[data-testid="nav-schedules"]');
      await page.click('[data-testid="create-schedule-button"]');

      // Try to generate without required fields
      await page.click('[data-testid="generate-schedule-button"]');

      // Should show validation errors
      await expect(page.locator('[data-testid="name-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="start-date-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="end-date-error"]')).toBeVisible();

      // Test invalid date range
      await page.fill('[data-testid="schedule-name"]', 'Invalid Schedule');
      await page.fill('[data-testid="start-date"]', '2024-01-28');
      await page.fill('[data-testid="end-date"]', '2024-01-21'); // End before start

      await page.click('[data-testid="generate-schedule-button"]');

      await expect(page.locator('[data-testid="date-range-error"]')).toBeVisible();
    });

    test('should handle generation failures gracefully', async ({ page }) => {
      // Mock API to simulate generation failure
      await page.route('/api/schedule/generate', route => {
        route.fulfill({
          status: 400,
          body: JSON.stringify({ detail: 'Unable to generate feasible schedule' })
        });
      });

      await page.click('[data-testid="nav-schedules"]');
      await page.click('[data-testid="create-schedule-button"]');

      await page.fill('[data-testid="schedule-name"]', 'Failed Schedule');
      await page.fill('[data-testid="start-date"]', '2024-01-15');
      await page.fill('[data-testid="end-date"]', '2024-01-21');

      await page.click('[data-testid="generate-schedule-button"]');

      // Should show error message
      await expect(page.locator('[data-testid="generation-error"]')).toBeVisible();
      await expect(page.locator('text=Unable to generate feasible schedule')).toBeVisible();

      // Should offer retry option
      await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();
    });
  });

  test.describe('Schedule Viewing and Navigation', () => {
    test.beforeEach(async ({ page }) => {
      // Create a schedule first
      await page.click('[data-testid="nav-schedules"]');
      await page.click('[data-testid="create-schedule-button"]');
      await page.fill('[data-testid="schedule-name"]', 'Test Schedule');
      await page.fill('[data-testid="start-date"]', '2024-01-15');
      await page.fill('[data-testid="end-date"]', '2024-01-21');
      await page.click('[data-testid="generate-schedule-button"]');
      await expect(page.locator('[data-testid="generation-progress"]')).not.toBeVisible({ timeout: 30000 });
    });

    test('should display schedule in calendar view', async ({ page }) => {
      // Should show calendar
      await expect(page.locator('[data-testid="schedule-calendar"]')).toBeVisible();

      // Should show week view by default
      await expect(page.locator('[data-testid="calendar-view-week"]')).toHaveClass(/active/);

      // Should display shifts as calendar events
      await expect(page.locator('[data-testid="calendar-event"]')).toHaveCount.greaterThan(0);
    });

    test('should switch between calendar views', async ({ page }) => {
      // Switch to month view
      await page.click('[data-testid="calendar-view-month"]');
      await expect(page.locator('[data-testid="calendar-view-month"]')).toHaveClass(/active/);

      // Switch to day view
      await page.click('[data-testid="calendar-view-day"]');
      await expect(page.locator('[data-testid="calendar-view-day"]')).toHaveClass(/active/);

      // Switch back to week view
      await page.click('[data-testid="calendar-view-week"]');
      await expect(page.locator('[data-testid="calendar-view-week"]')).toHaveClass(/active/);
    });

    test('should navigate between time periods', async ({ page }) => {
      // Go to next week
      await page.click('[data-testid="calendar-next"]');

      // Should update calendar display
      await expect(page.locator('[data-testid="calendar-title"]')).not.toContainText('January 15-21');

      // Go to previous week
      await page.click('[data-testid="calendar-prev"]');
      await page.click('[data-testid="calendar-prev"]');

      // Should go back further
      await expect(page.locator('[data-testid="calendar-title"]')).not.toContainText('January 15-21');

      // Go to today
      await page.click('[data-testid="calendar-today"]');

      // Should show current week
      const today = new Date();
      const currentMonth = today.toLocaleString('default', { month: 'long' });
      await expect(page.locator('[data-testid="calendar-title"]')).toContainText(currentMonth);
    });

    test('should show shift details on click', async ({ page }) => {
      // Click on a shift
      await page.click('[data-testid="calendar-event"]');

      // Should open shift details dialog
      await expect(page.locator('[data-testid="shift-details-dialog"]')).toBeVisible();

      // Should show shift information
      await expect(page.locator('[data-testid="shift-time"]')).toBeVisible();
      await expect(page.locator('[data-testid="shift-employees"]')).toBeVisible();
      await expect(page.locator('[data-testid="shift-position"]')).toBeVisible();

      // Should have edit and delete options
      await expect(page.locator('[data-testid="edit-shift-button"]')).toBeVisible();
      await expect(page.locator('[data-testid="delete-shift-button"]')).toBeVisible();

      // Close dialog
      await page.click('[data-testid="close-dialog-button"]');
      await expect(page.locator('[data-testid="shift-details-dialog"]')).not.toBeVisible();
    });
  });

  test.describe('Schedule Editing', () => {
    test.beforeEach(async ({ page }) => {
      // Create and navigate to a schedule
      await page.click('[data-testid="nav-schedules"]');
      await page.click('[data-testid="create-schedule-button"]');
      await page.fill('[data-testid="schedule-name"]', 'Editable Schedule');
      await page.fill('[data-testid="start-date"]', '2024-01-15');
      await page.fill('[data-testid="end-date"]', '2024-01-21');
      await page.click('[data-testid="generate-schedule-button"]');
      await expect(page.locator('[data-testid="generation-progress"]')).not.toBeVisible({ timeout: 30000 });
    });

    test('should edit shift details', async ({ page }) => {
      // Click on a shift to edit
      await page.click('[data-testid="calendar-event"]');
      await page.click('[data-testid="edit-shift-button"]');

      // Should open edit form
      await expect(page.locator('[data-testid="edit-shift-form"]')).toBeVisible();

      // Modify shift details
      await page.fill('[data-testid="shift-start-time"]', '10:00');
      await page.fill('[data-testid="shift-end-time"]', '18:00');

      // Save changes
      await page.click('[data-testid="save-shift-button"]');

      // Should update the calendar
      await expect(page.locator('[data-testid="edit-shift-form"]')).not.toBeVisible();

      // Verify changes were saved
      await page.click('[data-testid="calendar-event"]');
      await expect(page.locator('[data-testid="shift-time"]')).toContainText('10:00 - 18:00');
    });

    test('should reassign employees to shifts', async ({ page }) => {
      await page.click('[data-testid="calendar-event"]');
      await page.click('[data-testid="edit-shift-button"]');

      // Change employee assignment
      await page.click('[data-testid="employee-dropdown"]');
      await page.click('[data-testid="employee-option-jane"]');

      await page.click('[data-testid="save-shift-button"]');

      // Verify employee was reassigned
      await page.click('[data-testid="calendar-event"]');
      await expect(page.locator('[data-testid="shift-employees"]')).toContainText('Jane');
    });

    test('should delete shifts', async ({ page }) => {
      const initialShiftCount = await page.locator('[data-testid="calendar-event"]').count();

      await page.click('[data-testid="calendar-event"]');
      await page.click('[data-testid="delete-shift-button"]');

      // Should show confirmation dialog
      await expect(page.locator('[data-testid="confirm-delete-dialog"]')).toBeVisible();
      await page.click('[data-testid="confirm-delete-button"]');

      // Should remove shift from calendar
      await expect(page.locator('[data-testid="calendar-event"]')).toHaveCount(initialShiftCount - 1);
    });

    test('should add new shifts', async ({ page }) => {
      const initialShiftCount = await page.locator('[data-testid="calendar-event"]').count();

      // Double-click on empty calendar slot
      await page.dblclick('[data-testid="calendar-slot-empty"]');

      // Should open new shift form
      await expect(page.locator('[data-testid="new-shift-form"]')).toBeVisible();

      // Fill shift details
      await page.fill('[data-testid="shift-start-time"]', '14:00');
      await page.fill('[data-testid="shift-end-time"]', '22:00');
      await page.selectOption('[data-testid="shift-position"]', 'Server');
      await page.selectOption('[data-testid="shift-employee"]', 'John Doe');

      await page.click('[data-testid="create-shift-button"]');

      // Should add new shift to calendar
      await expect(page.locator('[data-testid="calendar-event"]')).toHaveCount(initialShiftCount + 1);
    });

    test('should handle drag and drop shift rescheduling', async ({ page }) => {
      // Get initial shift position
      const shift = page.locator('[data-testid="calendar-event"]').first();
      const initialPosition = await shift.boundingBox();

      // Drag shift to different time slot
      const targetSlot = page.locator('[data-testid="calendar-slot-empty"]').first();

      await shift.dragTo(targetSlot);

      // Should update shift time
      await expect(page.locator('[data-testid="calendar-event"]')).toHaveCount.greaterThan(0);

      // Verify shift moved
      const newPosition = await shift.boundingBox();
      expect(newPosition.x).not.toBe(initialPosition.x);
    });
  });

  test.describe('Schedule Optimization', () => {
    test.beforeEach(async ({ page }) => {
      // Create a schedule to optimize
      await page.click('[data-testid="nav-schedules"]');
      await page.click('[data-testid="create-schedule-button"]');
      await page.fill('[data-testid="schedule-name"]', 'Optimization Test');
      await page.fill('[data-testid="start-date"]', '2024-01-15');
      await page.fill('[data-testid="end-date"]', '2024-01-21');
      await page.click('[data-testid="generate-schedule-button"]');
      await expect(page.locator('[data-testid="generation-progress"]')).not.toBeVisible({ timeout: 30000 });
    });

    test('should optimize schedule for cost savings', async ({ page }) => {
      // Click optimize button
      await page.click('[data-testid="optimize-schedule-button"]');

      // Should show optimization options
      await expect(page.locator('[data-testid="optimization-dialog"]')).toBeVisible();

      // Select cost optimization
      await page.check('[data-testid="optimize-cost"]');
      await page.click('[data-testid="start-optimization-button"]');

      // Should show optimization progress
      await expect(page.locator('[data-testid="optimization-progress"]')).toBeVisible();
      await expect(page.locator('[data-testid="optimization-progress"]')).not.toBeVisible({ timeout: 60000 });

      // Should show optimization results
      await expect(page.locator('[data-testid="optimization-results"]')).toBeVisible();
      await expect(page.locator('[data-testid="cost-savings"]')).toBeVisible();

      // Should offer to apply changes
      await expect(page.locator('[data-testid="apply-optimization-button"]')).toBeVisible();
    });

    test('should optimize for employee satisfaction', async ({ page }) => {
      await page.click('[data-testid="optimize-schedule-button"]');

      await page.check('[data-testid="optimize-satisfaction"]');
      await page.click('[data-testid="start-optimization-button"]');

      await expect(page.locator('[data-testid="optimization-progress"]')).not.toBeVisible({ timeout: 60000 });

      // Should show satisfaction improvements
      await expect(page.locator('[data-testid="satisfaction-score"]')).toBeVisible();
      await expect(page.locator('[data-testid="preference-matches"]')).toBeVisible();
    });

    test('should show before/after comparison', async ({ page }) => {
      await page.click('[data-testid="optimize-schedule-button"]');
      await page.check('[data-testid="optimize-cost"]');
      await page.click('[data-testid="start-optimization-button"]');

      await expect(page.locator('[data-testid="optimization-progress"]')).not.toBeVisible({ timeout: 60000 });

      // Should show comparison view
      await expect(page.locator('[data-testid="before-after-comparison"]')).toBeVisible();
      await expect(page.locator('[data-testid="before-schedule"]')).toBeVisible();
      await expect(page.locator('[data-testid="after-schedule"]')).toBeVisible();

      // Should highlight changes
      await expect(page.locator('[data-testid="schedule-changes"]')).toBeVisible();
    });

    test('should allow rejecting optimization results', async ({ page }) => {
      await page.click('[data-testid="optimize-schedule-button"]');
      await page.check('[data-testid="optimize-cost"]');
      await page.click('[data-testid="start-optimization-button"]');

      await expect(page.locator('[data-testid="optimization-progress"]')).not.toBeVisible({ timeout: 60000 });

      // Reject optimization
      await page.click('[data-testid="reject-optimization-button"]');

      // Should return to original schedule
      await expect(page.locator('[data-testid="optimization-results"]')).not.toBeVisible();
      await expect(page.locator('[data-testid="schedule-calendar"]')).toBeVisible();
    });
  });

  test.describe('Schedule Publishing and Sharing', () => {
    test.beforeEach(async ({ page }) => {
      // Create a schedule
      await page.click('[data-testid="nav-schedules"]');
      await page.click('[data-testid="create-schedule-button"]');
      await page.fill('[data-testid="schedule-name"]', 'Publishing Test');
      await page.fill('[data-testid="start-date"]', '2024-01-15');
      await page.fill('[data-testid="end-date"]', '2024-01-21');
      await page.click('[data-testid="generate-schedule-button"]');
      await expect(page.locator('[data-testid="generation-progress"]')).not.toBeVisible({ timeout: 30000 });
    });

    test('should publish schedule to employees', async ({ page }) => {
      // Click publish button
      await page.click('[data-testid="publish-schedule-button"]');

      // Should show publish confirmation
      await expect(page.locator('[data-testid="publish-confirmation-dialog"]')).toBeVisible();

      // Should show employee list
      await expect(page.locator('[data-testid="employee-notification-list"]')).toBeVisible();

      // Confirm publishing
      await page.click('[data-testid="confirm-publish-button"]');

      // Should show success message
      await expect(page.locator('[data-testid="publish-success"]')).toBeVisible();

      // Schedule status should change to published
      await expect(page.locator('[data-testid="schedule-status"]')).toContainText('Published');
    });

    test('should export schedule in different formats', async ({ page }) => {
      await page.click('[data-testid="export-schedule-button"]');

      // Should show export options
      await expect(page.locator('[data-testid="export-dialog"]')).toBeVisible();

      // Test PDF export
      await page.click('[data-testid="export-pdf"]');
      // In a real test, you'd verify the download started
      await expect(page.locator('[data-testid="export-success"]')).toBeVisible();

      // Test Excel export
      await page.click('[data-testid="export-excel"]');
      await expect(page.locator('[data-testid="export-success"]')).toBeVisible();

      // Test CSV export
      await page.click('[data-testid="export-csv"]');
      await expect(page.locator('[data-testid="export-success"]')).toBeVisible();
    });

    test('should send schedule notifications', async ({ page }) => {
      await page.click('[data-testid="send-notifications-button"]');

      // Should show notification options
      await expect(page.locator('[data-testid="notification-dialog"]')).toBeVisible();

      // Select notification methods
      await page.check('[data-testid="notify-email"]');
      await page.check('[data-testid="notify-sms"]');

      // Add custom message
      await page.fill('[data-testid="notification-message"]', 'Your schedule for next week is ready!');

      await page.click('[data-testid="send-notifications-button"]');

      // Should show sending progress
      await expect(page.locator('[data-testid="sending-progress"]')).toBeVisible();
      await expect(page.locator('[data-testid="sending-progress"]')).not.toBeVisible({ timeout: 10000 });

      // Should show success
      await expect(page.locator('[data-testid="notifications-sent"]')).toBeVisible();
    });
  });

  test.describe('Schedule Analytics and Reporting', () => {
    test.beforeEach(async ({ page }) => {
      // Create multiple schedules for analytics
      for (let i = 0; i < 3; i++) {
        await page.click('[data-testid="nav-schedules"]');
        await page.click('[data-testid="create-schedule-button"]');
        await page.fill('[data-testid="schedule-name"]', `Analytics Schedule ${i + 1}`);
        await page.fill('[data-testid="start-date"]', `2024-01-${15 + i * 7}`);
        await page.fill('[data-testid="end-date"]', `2024-01-${21 + i * 7}`);
        await page.click('[data-testid="generate-schedule-button"]');
        await expect(page.locator('[data-testid="generation-progress"]')).not.toBeVisible({ timeout: 30000 });
      }
    });

    test('should display schedule analytics', async ({ page }) => {
      // Navigate to analytics
      await page.click('[data-testid="nav-analytics"]');

      // Should show schedule metrics
      await expect(page.locator('[data-testid="total-schedules"]')).toBeVisible();
      await expect(page.locator('[data-testid="avg-optimization-score"]')).toBeVisible();
      await expect(page.locator('[data-testid="cost-trends"]')).toBeVisible();

      // Should show charts
      await expect(page.locator('[data-testid="cost-chart"]')).toBeVisible();
      await expect(page.locator('[data-testid="satisfaction-chart"]')).toBeVisible();
    });

    test('should generate schedule reports', async ({ page }) => {
      await page.click('[data-testid="nav-analytics"]');
      await page.click('[data-testid="generate-report-button"]');

      // Should show report options
      await expect(page.locator('[data-testid="report-dialog"]')).toBeVisible();

      // Select report type
      await page.selectOption('[data-testid="report-type"]', 'monthly-summary');

      // Select date range
      await page.fill('[data-testid="report-start-date"]', '2024-01-01');
      await page.fill('[data-testid="report-end-date"]', '2024-01-31');

      await page.click('[data-testid="generate-report-confirm"]');

      // Should show report generation progress
      await expect(page.locator('[data-testid="report-progress"]')).toBeVisible();
      await expect(page.locator('[data-testid="report-progress"]')).not.toBeVisible({ timeout: 30000 });

      // Should display report
      await expect(page.locator('[data-testid="generated-report"]')).toBeVisible();
      await expect(page.locator('[data-testid="report-summary"]')).toBeVisible();
    });
  });

  test.describe('Error Handling and Edge Cases', () => {
    test('should handle network failures during schedule operations', async ({ page }) => {
      // Start creating a schedule
      await page.click('[data-testid="nav-schedules"]');
      await page.click('[data-testid="create-schedule-button"]');
      await page.fill('[data-testid="schedule-name"]', 'Network Test');
      await page.fill('[data-testid="start-date"]', '2024-01-15');
      await page.fill('[data-testid="end-date"]', '2024-01-21');

      // Simulate network failure
      await page.route('/api/schedule/generate', route => {
        route.abort('failed');
      });

      await page.click('[data-testid="generate-schedule-button"]');

      // Should show network error
      await expect(page.locator('[data-testid="network-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();
    });

    test('should handle concurrent schedule modifications', async ({ page, context }) => {
      // Create a schedule
      await page.click('[data-testid="nav-schedules"]');
      await page.click('[data-testid="create-schedule-button"]');
      await page.fill('[data-testid="schedule-name"]', 'Concurrent Test');
      await page.fill('[data-testid="start-date"]', '2024-01-15');
      await page.fill('[data-testid="end-date"]', '2024-01-21');
      await page.click('[data-testid="generate-schedule-button"]');
      await expect(page.locator('[data-testid="generation-progress"]')).not.toBeVisible({ timeout: 30000 });

      // Open same schedule in another tab
      const newPage = await context.newPage();
      await newPage.goto('/schedules');

      // Both pages modify the schedule simultaneously
      await Promise.all([
        page.click('[data-testid="calendar-event"]'),
        newPage.click('[data-testid="calendar-event"]')
      ]);

      // One should show conflict warning
      const hasConflictWarning = await page.locator('[data-testid="conflict-warning"]').isVisible() ||
                                 await newPage.locator('[data-testid="conflict-warning"]').isVisible();

      expect(hasConflictWarning).toBeTruthy();

      await newPage.close();
    });

    test('should handle insufficient employee coverage', async ({ page }) => {
      // Create scenario with high shift requirements and few employees
      await page.click('[data-testid="nav-schedules"]');
      await page.click('[data-testid="create-schedule-button"]');

      // Set up scenario requiring more coverage than available
      await page.fill('[data-testid="schedule-name"]', 'Understaffed Test');
      await page.fill('[data-testid="start-date"]', '2024-01-15');
      await page.fill('[data-testid="end-date"]', '2024-01-21');

      // Mock API to return coverage warning
      await page.route('/api/schedule/generate', route => {
        route.fulfill({
          status: 200,
          body: JSON.stringify({
            id: 1,
            shifts: [],
            warnings: ['Insufficient staff for requested coverage'],
            coverage_score: 65
          })
        });
      });

      await page.click('[data-testid="generate-schedule-button"]');

      // Should show coverage warnings
      await expect(page.locator('[data-testid="coverage-warning"]')).toBeVisible();
      await expect(page.locator('text=Insufficient staff')).toBeVisible();
      await expect(page.locator('[data-testid="coverage-score"]')).toContainText('65%');
    });
  });
});